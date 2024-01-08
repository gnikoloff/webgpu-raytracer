import { makeShaderDataDefinitions, makeStructuredView } from "webgpu-utils";

import CameraShaderChunk from "./shaders/utils/camera";
import CommonShaderChunk from "./shaders/utils/common";
import presentShaderSrc from "./shaders/present";
import raytracerShaderSrc from "./shaders/raytracer";
import { Camera } from "./Camera";

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

const camera = new Camera(canvas, [-2, 2, 1]);

// Set up compute and present pipelines
const drawPipeline = device.createRenderPipeline({
	layout: "auto",
	vertex: {
		module: device.createShaderModule({
			code: presentShaderSrc,
		}),
		entryPoint: "vertexMain",
	},
	fragment: {
		module: device.createShaderModule({
			code: presentShaderSrc,
		}),
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

const computePipeline = device.createComputePipeline({
	layout: "auto",
	compute: {
		module: device.createShaderModule({
			code: raytracerShaderSrc,
		}),
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
	aspectRatio: canvas.width / canvas.height,
	vfov: 40,
	lookFrom: [-2, 2, 1],
	lookAt: [0, 0, -1],
	vup: [0, 1, 0],
	defocusAngle: 3,
	focusDist: 3.4,
});

const showResultBindGroup = device.createBindGroup({
	layout: drawPipeline.getBindGroupLayout(0),
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

function drawFrame(ts) {
	ts /= 1000;

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

	const commandEncoder = device.createCommandEncoder();

	// raytrace
	const computePass = commandEncoder.beginComputePass();
	computePass.setBindGroup(0, computeBindGroup0);
	computePass.setPipeline(computePipeline);
	computePass.dispatchWorkgroups(
		Math.ceil(canvas.width / COMPUTE_WORKGROUP_SIZE_X),
		Math.ceil(canvas.height / COMPUTE_WORKGROUP_SIZE_Y),
		1,
	);
	computePass.end();

	// blit to screen
	const textureView = context.getCurrentTexture().createView();
	const renderPassDescriptor: GPURenderPassDescriptor = {
		colorAttachments: [
			{
				view: textureView,
				clearValue: { r: 0, g: 0, b: 0, a: 1 },
				loadOp: "clear",
				storeOp: "store",
			},
		],
	};
	const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
	renderPass.setBindGroup(0, showResultBindGroup);
	renderPass.setPipeline(drawPipeline);
	renderPass.draw(6);
	renderPass.end();

	device.queue.submit([commandEncoder.finish()]);

	frameCounter++;

	requestAnimationFrame(drawFrame);
}

function resize() {
	canvas.width = innerWidth; // * devicePixelRatio;
	canvas.height = innerHeight; // * devicePixelRatio;
	canvas.style.width = `${innerWidth}px`;
	canvas.style.height = `${innerHeight}px`;
}
