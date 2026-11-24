/** `rendering/driver/depth_prepass/disable_for_vendors`' default (`rendering_server.cpp:3747`). */
export const DEPTH_PREPASS_DISABLED_VENDORS = 'PowerVR,Mali,Adreno,Apple';

/** Whether gl_compatibility draws no depth prepass on the GPU `glRenderer` (`config.cpp:194-207`). */
export function vendorDisablesDepthPrepass(glRenderer: string, disabledVendors: string): boolean {
  const name = glRenderer.toLowerCase();
  return disabledVendors
    .split(',')
    .map((vendor) => vendor.trim())
    .some((vendor) => vendor !== '' && name.includes(vendor.toLowerCase()));
}
