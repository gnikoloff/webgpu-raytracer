import * as dat from "dat.gui";
import { makeShaderDataDefinitions, makeStructuredView } from "webgpu-utils";

import { Camera } from "./Camera";
import { Scene } from "./Scene";

import CameraShaderChunk from "./shaders/utils/camera";
import CommonShaderChunk from "./shaders/utils/common";
import presentShaderSrc from "./shaders/present";
import raytracerShaderSrc from "./shaders/raytracer";
import debugBVHShaderSrc from "./shaders/debug-bvh";
import { vec3 } from "gl-matrix";
import { Material } from "./Material";

const COMPUTE_WORKGROUP_SIZE_X = 16;
const COMPUTE_WORKGROUP_SIZE_Y = 16;
const MAX_BOUNCES_INTERACTING = 3;

const shaderSeed = [Math.random(), Math.random(), Math.random()];
let frameCounter = 0;
let maxBounces = 16;
let flatShading = 0;

const $frameCounter = document.getElementById("frame-count");
const $progress = document.getElementById("progress");
const $progresPercent = document.getElementById("progress-percent");

// GUI
const guiSettings = {
	"Max Samples": 10000,
	"Ray Bounces Count": maxBounces,
	"Debug BVH": false,
	"Use Phong Shading": true,
};
const gui = new dat.GUI();
gui.width = 400;
gui.add(guiSettings, "Debug BVH");
gui.add(guiSettings, "Ray Bounces Count", 1, 16, 1).onChange((v) => {
	frameCounter = 0;
	maxBounces = v;
});
gui.add(guiSettings, "Max Samples", 1, 10000, 5).onChange((v) => {
	frameCounter = 0;
});
gui.add(guiSettings, "Use Phong Shading").onChange((v) => {
	flatShading = v ? 0 : 1;
	frameCounter = 0;
});

// Set canvas and GPU device
const canvas = document.createElement("canvas") as HTMLCanvasElement;
canvas.setAttribute("id", "c");
resize();
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice({
	requiredLimits: {},
});
const context = canvas.getContext("webgpu") as GPUCanvasContext;
const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
context.configure({
	device,
	format: presentationFormat,
	alphaMode: "premultiplied",
});

const camera = new Camera(
	canvas,
	vec3.fromValues(0, 0, 3.5),
	60,
	canvas.width / canvas.height,
);
const scene = new Scene(device);

const renderPassDescriptor: GPURenderPassDescriptor = {
	colorAttachments: [
		{
			view: null,
			clearValue: { r: 0, g: 0, b: 0, a: 1 },
			loadOp: "clear",
			storeOp: "store",
		},
	],
};

await scene.loadModels();

// Set up compute, debug and present pipelines
const blitScreenShaderModule = device.createShaderModule({
	code: presentShaderSrc,
});
const debugBVHShaderModule = device.createShaderModule({
	code: debugBVHShaderSrc,
});
const raytraceShaderModule = device.createShaderModule({
	code: raytracerShaderSrc,
});

const blitToScreenPipeline = device.createRenderPipeline({
	layout: "auto",
	vertex: {
		module: blitScreenShaderModule,
		entryPoint: "vertexMain",
	},
	fragment: {
		module: blitScreenShaderModule,
		entryPoint: "fragmentMain",
		targets: [
			{
				format: presentationFormat,
			},
		],
	},
	primitive: {
		topology: "triangle-list",
		cullMode: "back",
	},
});

const debugBVHPipeline = device.createRenderPipeline({
	layout: "auto",
	vertex: {
		module: debugBVHShaderModule,
		entryPoint: "vertexMain",
	},
	fragment: {
		module: debugBVHShaderModule,
		entryPoint: "fragmentMain",
		targets: [
			{
				format: presentationFormat,
				blend: {
					color: {
						srcFactor: "one",
						dstFactor: "one-minus-src-alpha",
					},
					alpha: {
						srcFactor: "one",
						dstFactor: "one-minus-src-alpha",
					},
				},
			},
		],
	},
	primitive: {
		topology: "line-list",
	},
});

const computePipeline = device.createComputePipeline({
	layout: "auto",
	compute: {
		module: raytraceShaderModule,
		entryPoint: "main",
		constants: {
			WORKGROUP_SIZE_X: COMPUTE_WORKGROUP_SIZE_X,
			WORKGROUP_SIZE_Y: COMPUTE_WORKGROUP_SIZE_Y,
			OBJECTS_COUNT_IN_SCENE: Scene.MODELS_COUNT,
			MAX_BVs_COUNT_PER_MESH: Scene.MAX_NUM_BVs_PER_MESH,
			MAX_FACES_COUNT_PER_MESH: Scene.MAX_NUM_FACES_PER_MESH,
		},
	},
});

const raytracedStorageBuffer = device.createBuffer({
	size: Float32Array.BYTES_PER_ELEMENT * 4 * canvas.width * canvas.height,
	usage: GPUBufferUsage.STORAGE,
});

const rngStateBuffer = device.createBuffer({
	size: Uint32Array.BYTES_PER_ELEMENT * canvas.width * canvas.height,
	usage: GPUBufferUsage.STORAGE,
	mappedAtCreation: true,
});
const rngState = new Uint32Array(rngStateBuffer.getMappedRange());
for (let i = 0; i < canvas.width * canvas.height; i++) {
	rngState[i] = i;
}
rngStateBuffer.unmap();

// Set up common uniforms
const commonShaderDefs = makeShaderDataDefinitions(CommonShaderChunk);
const commonUniformValues = makeStructuredView(
	commonShaderDefs.structs.CommonUniforms,
);
const commonUniformsBuffer = device.createBuffer({
	size: commonUniformValues.arrayBuffer.byteLength,
	usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

// Set up camera uniforms
const cameraShaderDefs = makeShaderDataDefinitions(CameraShaderChunk);
const cameraUniformValues = makeStructuredView(cameraShaderDefs.structs.Camera);
const cameraUniformBuffer = device.createBuffer({
	size: cameraUniformValues.arrayBuffer.byteLength,
	usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
cameraUniformValues.set({
	viewportSize: [canvas.width, canvas.height],
	imageWidth: canvas.width,
	aspectRatio: camera.aspectRatio,
	vfov: camera.vfov,
	lookFrom: [0, 0, 2],
	lookAt: [0, 0, 0],
	vup: [0, 1, 0],
	defocusAngle: 0,
	focusDist: 3.4,
});

const cameraViewProjMatrixBuffer = device.createBuffer({
	size: 16 * Float32Array.BYTES_PER_ELEMENT,
	usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

const showResultBindGroup = device.createBindGroup({
	layout: blitToScreenPipeline.getBindGroupLayout(0),
	entries: [
		{
			binding: 0,
			resource: {
				buffer: raytracedStorageBuffer,
			},
		},
		{
			binding: 1,
			resource: {
				buffer: cameraUniformBuffer,
			},
		},
		{
			binding: 2,
			resource: {
				buffer: commonUniformsBuffer,
			},
		},
	],
});

const debugBVHBindGroup = device.createBindGroup({
	layout: debugBVHPipeline.getBindGroupLayout(0),
	entries: [
		{
			binding: 0,
			resource: {
				buffer: scene.aabbsBuffer,
			},
		},
		{
			binding: 1,
			resource: {
				buffer: cameraViewProjMatrixBuffer,
			},
		},
	],
});

const computeBindGroup0 = device.createBindGroup({
	layout: computePipeline.getBindGroupLayout(0),
	entries: [
		{
			binding: 0,
			resource: {
				buffer: raytracedStorageBuffer,
			},
		},
		{
			binding: 1,
			resource: {
				buffer: rngStateBuffer,
			},
		},
		{
			binding: 2,
			resource: {
				buffer: commonUniformsBuffer,
			},
		},
		{
			binding: 3,
			resource: {
				buffer: cameraUniformBuffer,
			},
		},
	],
});
const computeBindGroup1 = device.createBindGroup({
	layout: computePipeline.getBindGroupLayout(1),
	entries: [
		{
			binding: 0,
			resource: {
				buffer: scene.facesBuffer,
			},
		},
		{
			binding: 1,
			resource: {
				buffer: scene.aabbsBuffer,
			},
		},
		{
			binding: 2,
			resource: {
				buffer: scene.materialsBuffer,
			},
		},
	],
});

// Init app
document.body.appendChild(canvas);
canvas.addEventListener("mousedown", onMouseDown);
canvas.addEventListener("mouseup", onMouseUp);
canvas.addEventListener("wheel", onWheel, { passive: true });
requestAnimationFrame(drawFrame);

function onMouseDown(e: MouseEvent) {
	maxBounces = MAX_BOUNCES_INTERACTING;
	canvas.addEventListener("mousemove", onMouseMove);
}

function onMouseMove(e: MouseEvent) {
	frameCounter = 0;
}

function onMouseUp(e: MouseEvent) {
	maxBounces = guiSettings["Ray Bounces Count"];
	canvas.removeEventListener("mousemove", onMouseMove);
}

function onWheel() {
	// maxBounces = MAX_BOUNCES_INTERACTING;
	frameCounter = 0;
}

function drawFrame() {
	requestAnimationFrame(drawFrame);

	$frameCounter.textContent = frameCounter.toString();
	const progresPercent = (frameCounter / guiSettings["Max Samples"]) * 100;
	$progress.style.width = `${progresPercent}%`;
	$progresPercent.className =
		progresPercent < 5 ? "docked-left" : "docked-right";
	$progresPercent.textContent = `${progresPercent.toFixed(0)}%`;

	if (frameCounter === guiSettings["Max Samples"]) {
		return;
	}

	camera.tick();

	shaderSeed[0] = Math.random() * 0xffffff;
	shaderSeed[1] = Math.random() * 0xffffff;
	shaderSeed[2] = Math.random() * 0xffffff;

	commonUniformValues.set({
		seed: shaderSeed,
		frameCounter,
		maxBounces,
		flatShading,
	});
	device.queue.writeBuffer(
		commonUniformsBuffer,
		0,
		commonUniformValues.arrayBuffer,
	);

	cameraUniformValues.set({
		lookFrom: camera.position,
		lookAt: camera.target,
	});
	device.queue.writeBuffer(
		cameraUniformBuffer,
		0,
		cameraUniformValues.arrayBuffer,
	);

	device.queue.writeBuffer(
		cameraViewProjMatrixBuffer,
		0,
		camera.viewProjectionMatrix,
	);

	const commandEncoder = device.createCommandEncoder();

	// raytrace
	const computePass = commandEncoder.beginComputePass();
	computePass.setPipeline(computePipeline);
	computePass.setBindGroup(0, computeBindGroup0);
	computePass.setBindGroup(1, computeBindGroup1);
	computePass.dispatchWorkgroups(
		Math.ceil(canvas.width / COMPUTE_WORKGROUP_SIZE_X),
		Math.ceil(canvas.height / COMPUTE_WORKGROUP_SIZE_Y),
		1,
	);
	computePass.end();

	renderPassDescriptor.colorAttachments[0].view = context
		.getCurrentTexture()
		.createView();
	const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);

	// blit to screen
	renderPass.setPipeline(blitToScreenPipeline);
	renderPass.setBindGroup(0, showResultBindGroup);
	renderPass.draw(6);

	// debug BVH
	if (guiSettings["Debug BVH"]) {
		renderPass.setPipeline(debugBVHPipeline);
		renderPass.setBindGroup(0, debugBVHBindGroup);
		renderPass.draw(2, Scene.AABBS_COUNT * 12);
	}

	renderPass.end();
	device.queue.submit([commandEncoder.finish()]);

	frameCounter++;
}

function resize() {
	const w = Math.min(innerWidth, 1920);
	const h = Math.min(innerHeight, 1080);
	canvas.width = w; // * devicePixelRatio;
	canvas.height = h; // * devicePixelRatio;
	canvas.style.width = `${w}px`;
	canvas.style.height = `${h}px`;
	canvas.style.marginTop = `${-h * 0.5}px`;
	canvas.style.marginLeft = `${-w * 0.5}px`;
}
