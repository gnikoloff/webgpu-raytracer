import { makeShaderDataDefinitions, makeStructuredView } from "webgpu-utils";

import { Camera } from "./Camera";
import { Scene } from "./Scene";

import CameraShaderChunk from "./shaders/utils/camera";
import CommonShaderChunk from "./shaders/utils/common";
import presentShaderSrc from "./shaders/present";
import raytracerShaderSrc from "./shaders/raytracer";
import debugBVHShaderSrc from "./shaders/debug-bvh";
import { vec3 } from "gl-matrix";

const COMPUTE_WORKGROUP_SIZE_X = 16;
const COMPUTE_WORKGROUP_SIZE_Y = 16;

const shaderSeed = [Math.random(), Math.random(), Math.random()];
let frameCounter = 0;

// Set canvas and GPU device
const canvas = document.createElement("canvas") as HTMLCanvasElement;
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
	vec3.fromValues(-2, 2, 1),
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
			workgroupSizeX: COMPUTE_WORKGROUP_SIZE_X,
			workgroupSizeY: COMPUTE_WORKGROUP_SIZE_Y,
		},
	},
});

const raytracedStorageBuffer = device.createBuffer({
	size: Float32Array.BYTES_PER_ELEMENT * 4 * canvas.width * canvas.height,
	usage: GPUBufferUsage.STORAGE,
});

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
				buffer: commonUniformsBuffer,
			},
		},
		{
			binding: 2,
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
	],
});

// Init app
document.body.appendChild(canvas);
canvas.addEventListener("mousedown", onMouseDown);
canvas.addEventListener("mouseup", onMouseUp);
canvas.addEventListener("wheel", onWheel);
requestAnimationFrame(drawFrame);

function onMouseDown(e: MouseEvent) {
	canvas.addEventListener("mousemove", onMouseMove);
}

function onMouseMove(e: MouseEvent) {
	frameCounter = 0;
}

function onMouseUp(e: MouseEvent) {
	canvas.removeEventListener("mousemove", onMouseMove);
}

function onWheel() {
	frameCounter = 0;
}

function drawFrame() {
	requestAnimationFrame(drawFrame);

	camera.tick();

	shaderSeed[0] = Math.random() * 0xffffff;
	shaderSeed[1] = Math.random() * 0xffffff;
	shaderSeed[2] = Math.random() * 0xffffff;

	commonUniformValues.set({
		seed: shaderSeed,
		frameCounter,
		maxBounces: 10,
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
	renderPass.setPipeline(debugBVHPipeline);
	renderPass.setBindGroup(0, debugBVHBindGroup);
	renderPass.draw(2, Scene.AABBS_COUNT * 12);

	renderPass.end();
	device.queue.submit([commandEncoder.finish()]);

	frameCounter++;
}

function resize() {
	canvas.width = innerWidth; // * devicePixelRatio;
	canvas.height = innerHeight; // * devicePixelRatio;
	canvas.style.width = `${innerWidth}px`;
	canvas.style.height = `${innerHeight}px`;
}
