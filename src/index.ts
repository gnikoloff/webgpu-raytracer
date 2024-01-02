import vertexShaderSrc from "./vertex.wgsl?raw";
import fragmentShaderSrc from "./fragment.wgsl?raw";

const canvas = document.createElement("canvas") as HTMLCanvasElement;
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();

const context = canvas.getContext("webgpu") as GPUCanvasContext;

const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

context.configure({
	device,
	format: presentationFormat,
	alphaMode: "premultiplied",
});

const pipeline = device.createRenderPipeline({
	layout: "auto",
	vertex: {
		module: device.createShaderModule({
			code: vertexShaderSrc,
		}),
		entryPoint: "main",
	},
	fragment: {
		module: device.createShaderModule({
			code: fragmentShaderSrc,
		}),
		entryPoint: "main",
		targets: [
			{
				format: presentationFormat,
			},
		],
	},
	primitive: {
		topology: "triangle-list",
	},
});

document.body.appendChild(canvas);
requestAnimationFrame(drawFrame);
resize();

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

	const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
	passEncoder.setPipeline(pipeline);
	passEncoder.draw(6);
	passEncoder.end();

	device.queue.submit([commandEncoder.finish()]);

	requestAnimationFrame(drawFrame);
}

function resize() {
	canvas.width = innerWidth * devicePixelRatio;
	canvas.height = innerHeight * devicePixelRatio;
	canvas.style.width = `${innerWidth}px`;
	canvas.style.height = `${innerHeight}px`;
}
