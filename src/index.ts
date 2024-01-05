import presentShaderSrc from "./shaders/present";
import raytracerShaderSrc from "./shaders/raytracer";

const canvas = document.createElement("canvas") as HTMLCanvasElement;
resize();

const shaderSeed = new Uint32Array([
	Math.random(),
	Math.random(),
	Math.random(),
]);
const frameCounter = new Uint32Array([0]);
const viewportSize = new Uint32Array(4);

const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice({
	requiredLimits: {
		maxStorageBufferBindingSize: 100 * 1024 * 1024,
	},
});

const context = canvas.getContext("webgpu") as GPUCanvasContext;

const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

context.configure({
	device,
	format: presentationFormat,
	alphaMode: "premultiplied",
});

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
			workgroupSizeX: 16,
			workgroupSizeY: 16,
		},
	},
});

const raytracedStorageBuffer = device.createBuffer({
	size: Float32Array.BYTES_PER_ELEMENT * 4 * canvas.width * canvas.height,
	usage: GPUBufferUsage.STORAGE,
});

const commonUniformsBuffer = device.createBuffer({
	size: 8 * Uint32Array.BYTES_PER_ELEMENT,
	usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
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
				buffer: commonUniformsBuffer,
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
	],
});

document.body.appendChild(canvas);
requestAnimationFrame(drawFrame);

function drawFrame(ts) {
	const commandEncoder = device.createCommandEncoder();
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

	shaderSeed[0] = Math.random() * 0xffffff;
	shaderSeed[1] = Math.random() * 0xffffff;
	shaderSeed[2] = Math.random() * 0xffffff;
	frameCounter[0] += 1;
	viewportSize[0] = canvas.width;
	viewportSize[1] = canvas.height;

	device.queue.writeBuffer(commonUniformsBuffer, 0, shaderSeed);
	device.queue.writeBuffer(
		commonUniformsBuffer,
		3 * Uint32Array.BYTES_PER_ELEMENT,
		frameCounter,
	);
	device.queue.writeBuffer(
		commonUniformsBuffer,
		4 * Uint32Array.BYTES_PER_ELEMENT,
		viewportSize,
	);

	const computePass = commandEncoder.beginComputePass();
	computePass.setBindGroup(0, computeBindGroup0);
	computePass.setPipeline(computePipeline);
	computePass.dispatchWorkgroups(
		Math.ceil(canvas.width / 16),
		Math.ceil(canvas.height / 16),
		1,
	);
	computePass.end();

	const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
	renderPass.setBindGroup(0, showResultBindGroup);
	renderPass.setPipeline(drawPipeline);
	renderPass.draw(6);
	renderPass.end();
	device.queue.submit([commandEncoder.finish()]);

	requestAnimationFrame(drawFrame);
}

function resize() {
	canvas.width = innerWidth; //* devicePixelRatio;
	canvas.height = innerHeight; //* devicePixelRatio;
	canvas.style.width = `${innerWidth}px`;
	canvas.style.height = `${innerHeight}px`;
}
