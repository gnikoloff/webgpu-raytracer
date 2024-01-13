# WebGPU Raytracer

1. [Requirements](#requirements)
2. [Summary](#summary)
3. [App Architecture](#app-architecture)
   1. [Typescript](#typescript)
   2. [Compute Shader](#compute-shader)
   3. [Blit-to-Screen Fragment Shader](#blit-to-screen-fragment-shader)
   4. [Libraries used](#libraries-used)
4. [References and Readings](#references-and-readings)

## Requirements

The app currently works only on Chrome as it supports WebGPU without a flag and fully follows the WebGPU specification. Firefox and Safari have experimental support for it but this demo does not currently run on them.

Warning! The app requires a reasonably powerful GPU. Your phone or tablet is probably not going to cut it. Old Intel-based Macs should be OK. I developed it on a M1 Max Mac Studio.

## Summary

After doing rasterization for years, I was very intrigued by raytracing. After all, it is the holy grail of computer graphics, producing incredible photorealistic imagery with soft shadows, ambient occlusion and blurred reflections. These effects are difficult to achieve using a real-time 3D rasterizer but here you essentially get them for free with little to no rendering tricks involved.

At the end of the day I ended up with what's called a path tracer. It requires a large quantity of rays to be fired through each pixel in a stochastic manner for convergence thus removing noise from the rendered image.

## App Architecture

### Typescript

This portion of the code runs on the CPU. It reads the triangles information from the Wavefront OBJ and MTL files, create Bounding Volume Hierarchy trees and pushes all data to the GPU. It then handles submitting work to the GPU on each frame, handles user input and interaction with the camera.

### Compute Shader

This is the heart of the raytracer. It bounces rays around the scene and gathers the accumulated color that it finally writes to the pixel in a image buffer. The image buffer is then blitted to the device screen.

There already exist WebGPU raytracers that do all the path tracing in a fragment shader. Why did I opt for a compute shader instead? Learning practice, that's all. I was curious to explore WebGPU compute shaders more in-depth. That being said, this raytracer can easily be ported to run in a fragment shader instead.

#### Bounding Volume Hierarchy

Testing each ray against each triangle compromising the scene is naive and slow. That's where accelerated structures such as BVH come into play. You wrap each object in a box and then recursively add more boxes for different parts of the object. Think about a person: you add a box surrounding them, then one box for each limb and one box for each finger. If the ray does not intersect the person you don't check any triangles in the libmbs or fingers. If it hits the right arm, you don't check the triangles in the left foot and so on. This significantly sped up the render times in this app.

#### No textures, storage buffers instead

In order to store all the state that the raytracer needs, such as random number generation and image state, it's easier to use WebGPU storage buffers than textures, as you can place arbitrary data in a storage buffer.

For instance, I want to accumulate pixel samples over multiple frames. A buffer is required to hold the accumulated samples. It may seem natural to use a storage texture to store pixel values, but storage textures do not currently allow being read from from a compute shader. `texture_storage_2d<rgba8unorm, write>` is supported, but `texture_storage_2d<rgba8unorm, read>` is hidden behind a flag.

So instead I use storage buffers:

```wgsl
// read_write is important, we want to read the old frame and write the new frame
@group(0) @binding(0) var<storage, read_write> raytraceImageBuffer: array<vec3f>;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) globalInvocationId : vec3<u32>) {
  let pos = globalInvocationId.xy;
  let idx = pos.x + pos.y * cameraUniforms.viewportSize.x;

  let oldFrameContents = raytraceImageBuffer[idx];
  let color: vec3f = /* calculate new color value somehow */

  // accumulate the new frame contents with the old frame content value
  raytraceImageBuffer[idx] += color;
}
```

#### Recursion via looping

Raytracing on the CPU is easily done via recursion. Something like:

```c++
color ray_color(const ray& r, const hittable& world) const {
    hit_record rec;
    if (world.hit(r, interval(0, infinity), rec)) {
        vec3 direction = random_on_hemisphere(rec.normal);
        return 0.5 * ray_color(ray(rec.p, direction), world);
    }
    return color(0, 0, 0);
}
```

Recursion is not allowed on the GPU however. Therefore the app uses loops to achieve recursion in the compute shader.

### Blit-to-Screen Fragment Shader

After the raytracing compute shader is finished on each frame, it's results are blitted to the device screen using a fragment shader ran on a fullscreen quad. At this point tonemapping is applied too.

### Libraries used

1. [`gl-matrix`](https://glmatrix.net/) for common matrix / vector operations
2. [`mtl-file-parser`](https://www.npmjs.com/package/mtl-file-parser) for Wavefront MTL file parsing
3. [`obj-file-parser`](https://www.npmjs.com/package/obj-file-parser) for Wavefront OBJ file parsing
4. [`webgpu-utils`](https://github.com/greggman/webgpu-utils) for simplifying passing values to WebGPU buffers
5. [`WebGPU Offset Computer`](https://webgpufundamentals.org/webgpu/lessons/resources/wgsl-offset-computer.html) - invaluable tool to visualise std140 struct layouts

## References and Readings

1. [Raytracing in a Weekend](https://raytracing.github.io/books/RayTracingInOneWeekend.html) - this is where everybody starts with raytracing it seems. I followed Book 1 and 2 and implemented them in C++ before switching to a compute shader approach.
2. [Intel Path-Tracing Workshop](https://www.intel.com/content/www/us/en/developer/videos/path-tracing-workshop-part-1.html) - Raytracing in a Weekend runs on the CPU and does not really explain how to port it to the GPU (where recursion is not allowed). This 2 videos show very well how to do the same task via loops in GLSL. The theory and math presented are also really good.
3. [Weekend Raytracing with wgpu](https://nelari.us/post/weekend_raytracing_with_wgpu_1/) - Porting "Raytracing in a Weekend" Book 1 to WebGPU. I got the idea to use storage buffers for the frame pixel contents here.
4. [WebGL Ray Tracer](https://github.com/kamyy/webgl-ray-tracer) - Path tracer written in WebGL. I studied the code and implemented my model parsing and BVH generation based on it.
