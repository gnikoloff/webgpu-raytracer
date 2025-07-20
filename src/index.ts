import * as dat from "dat.gui";
import * as dayjs from "dayjs";
import Duration from "dayjs/plugin/duration";
import { makeShaderDataDefinitions, makeStructuredView } from "webgpu-utils";

import { Camera } from "./Camera";
import { Scene } from "./Scene";

import { vec3 } from "gl-matrix";
import debugBVHShaderSrc from "./shaders/debug-bvh";
import presentShaderSrc from "./shaders/present";
import raytracerShaderSrc from "./shaders/raytracer";
import CameraShaderChunk from "./shaders/utils/camera";
import CommonShaderChunk from "./shaders/utils/common";

dayjs.extend(Duration);

const COMPUTE_WORKGROUP_SIZE_X = 16;
const COMPUTE_WORKGROUP_SIZE_Y = 16;
const MAX_BOUNCES_INTERACTING = 1;

const shaderSeed = [Math.random(), Math.random(), Math.random()];
let frameCounter = 0;
let maxBounces = 1; // 8;
let flatShading = 0;
let oldTimeMs = 0;
let timeExpiredMs = 0;

const $frameCounter = document.getElementById("frame-count");
const $timeExpired = document.getElementById("time-expired");
const $progress = document.getElementById("progress");
const $progresPercent = document.getElementById("progress-percent");

// GUI
const guiSettings = {
	"Max Samples": 5000,
	"Ray Bounces Count": maxBounces,
	"Debug BVH": false,
	"Debug Normals": false,
	"Use Phong Shading": true,
	"Crystal Suzanne": false,
};

// Set canvas and GPU device
const canvas = document.createElement("canvas") as HTMLCanvasElement;
canvas.setAttribute("id", "c");
resize();
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice({
	requiredLimits: {},
});
const context = canvas.getContext("webgpu") as GPUCanvasContext;
const presentationFormat = navigator.gpu.getPreferredCanvasFormat
	? navigator.gpu.getPreferredCanvasFormat()
	: "bgra8unorm";
context.configure({
	device,
	format: presentationFormat,
	alphaMode: "premultiplied",
});

// Set up camera and scene
const camera = new Camera(
	canvas,
	vec3.fromValues(0, 0, 3.5),
	60,
	canvas.width / canvas.height,
);
const scene = new Scene(device);
await scene.loadModels();

// Set up blit-to-screen render pipeline
const blitScreenShaderModule = device.createShaderModule({
	code: presentShaderSrc,
});
const blitToScreenBindGroup0Layout = device.createBindGroupLayout({
	entries: [
		{
			binding: 0,
			visibility: GPUShaderStage.FRAGMENT,
			buffer: { type: "storage" },
		},
		{
			binding: 1,
			visibility: GPUShaderStage.FRAGMENT,
			buffer: {
				type: "uniform",
			},
		},
		{
			binding: 2,
			visibility: GPUShaderStage.FRAGMENT,
			buffer: {
				type: "uniform",
			},
		},
	],
});
const blitToScreenPipeline = device.createRenderPipeline({
	layout: device.createPipelineLayout({
		bindGroupLayouts: [blitToScreenBindGroup0Layout],
	}),
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

// Set up debug BVH render pipeline
const debugBVHBindGroup0Layout = device.createBindGroupLayout({
	entries: [
		{
			binding: 0,
			visibility: GPUShaderStage.VERTEX,
			buffer: {
				type: "read-only-storage",
			},
		},
		{
			binding: 1,
			visibility: GPUShaderStage.VERTEX,
			buffer: {
				type: "uniform",
			},
		},
	],
});

const debugBVHShaderModule = device.createShaderModule({
	code: debugBVHShaderSrc,
});
const debugBVHPipeline = device.createRenderPipeline({
	layout: device.createPipelineLayout({
		bindGroupLayouts: [debugBVHBindGroup0Layout],
	}),
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

// Set up raytrace compute pipeline
const raytraceBindGroup0Layout = device.createBindGroupLayout({
	entries: [
		{
			binding: 0,
			visibility: GPUShaderStage.COMPUTE,
			buffer: {
				type: "storage",
			},
		},
		{
			binding: 1,
			visibility: GPUShaderStage.COMPUTE,
			buffer: {
				type: "storage",
			},
		},
		{
			binding: 2,
			visibility: GPUShaderStage.COMPUTE,
			buffer: {
				type: "uniform",
			},
		},
		{
			binding: 3,
			visibility: GPUShaderStage.COMPUTE,
			buffer: {
				type: "uniform",
			},
		},
	],
});

const raytraceBindGroup1Layout = device.createBindGroupLayout({
	entries: [
		{
			binding: 0,
			visibility: GPUShaderStage.COMPUTE,
			buffer: {
				type: "read-only-storage",
			},
		},
		{
			binding: 1,
			visibility: GPUShaderStage.COMPUTE,
			buffer: {
				type: "read-only-storage",
			},
		},
		{
			binding: 2,
			visibility: GPUShaderStage.COMPUTE,
			buffer: {
				type: "read-only-storage",
			},
		},
	],
});

const raytraceShaderModule = device.createShaderModule({
	code: raytracerShaderSrc,
});
const computePipeline = device.createComputePipeline({
	layout: device.createPipelineLayout({
		bindGroupLayouts: [raytraceBindGroup0Layout, raytraceBindGroup1Layout],
	}),
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
raytracedStorageBuffer.label = "Raytraced Image Buffer";

const rngStateBuffer = device.createBuffer({
	size: Uint32Array.BYTES_PER_ELEMENT * canvas.width * canvas.height,
	usage: GPUBufferUsage.STORAGE,
	mappedAtCreation: true,
});
rngStateBuffer.label = "RNG State Buffer";
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
commonUniformsBuffer.label = "Common Uniforms Buffer";

// Set up camera uniforms
const cameraShaderDefs = makeShaderDataDefinitions(CameraShaderChunk);
const cameraUniformValues = makeStructuredView(cameraShaderDefs.structs.Camera);
const cameraUniformBuffer = device.createBuffer({
	size: cameraUniformValues.arrayBuffer.byteLength,
	usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
cameraUniformBuffer.label = "Camera Uniforms Buffer";
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
cameraViewProjMatrixBuffer.label = "Camera ViewProjection Matrix";

const blitToScreenBindGroup0 = device.createBindGroup({
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

// Init app
document.body.classList.add("loaded");
document.body.appendChild(canvas);
canvas.addEventListener("mousedown", onMouseDown);
canvas.addEventListener("mouseup", onMouseUp);
canvas.addEventListener("wheel", onWheel, { passive: true });

canvas.addEventListener("touchstart", onTouchStart);
canvas.addEventListener("touchend", onTouchEnd);

initGUI();
requestAnimationFrame(drawFrame);

function onTouchStart(e: TouchEvent) {
	e.preventDefault();
	maxBounces = MAX_BOUNCES_INTERACTING;
	canvas.addEventListener("touchmove", onTouchMove);
}

function onTouchEnd(e: TouchEvent) {
	e.preventDefault();
	maxBounces = guiSettings["Ray Bounces Count"];
	canvas.removeEventListener("touchmove", onTouchMove);
}

function onTouchMove(e: TouchEvent) {
	e.preventDefault();
	resetRender();
}

function onMouseDown(e: MouseEvent) {
	maxBounces = MAX_BOUNCES_INTERACTING;
	canvas.addEventListener("mousemove", onMouseMove);
}

function onMouseMove(e: MouseEvent) {
	resetRender();
}

function onMouseUp(e: MouseEvent) {
	maxBounces = guiSettings["Ray Bounces Count"];
	canvas.removeEventListener("mousemove", onMouseMove);
}

function onWheel() {
	resetRender();
}

function drawFrame() {
	const nowMs = performance.now();
	const diff = nowMs - oldTimeMs;
	oldTimeMs = nowMs;
	timeExpiredMs += diff;
	requestAnimationFrame(drawFrame);

	$frameCounter.textContent = frameCounter.toString();
	$timeExpired.textContent = dayjs.duration(timeExpiredMs).format("mm:ss");
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
		debugNormals: guiSettings["Debug Normals"] ? 1 : 0,
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

	// blit raytraced image buffer to screen
	renderPass.setPipeline(blitToScreenPipeline);
	renderPass.setBindGroup(0, blitToScreenBindGroup0);
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

function resetRender() {
	frameCounter = 0;
	oldTimeMs = performance.now();
	timeExpiredMs = 0;
}

function initGUI() {
	const gui = new dat.GUI();
	gui.width = 400;
	gui.add(guiSettings, "Debug BVH");
	gui.add(guiSettings, "Debug Normals").onChange(() => {
		resetRender();
	});
	gui.add(guiSettings, "Use Phong Shading").onChange((v) => {
		flatShading = v ? 0 : 1;
		resetRender();
	});
	gui.add(guiSettings, "Crystal Suzanne").onChange((v) => {
		scene.isSuzanneGlass = v;
		resetRender();
	});
	gui.add(guiSettings, "Ray Bounces Count", 1, 16, 1).onChange((v) => {
		resetRender();
		maxBounces = v;
	});
	gui.add(guiSettings, "Max Samples", 1, 10000, 5).onChange((v) => {
		resetRender();
	});
}
