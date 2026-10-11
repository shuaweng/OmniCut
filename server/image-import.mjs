import path from 'node:path';
import sharp from 'sharp';

// File-picker MIME and extensions can disagree (for example, a browser
// screenshot saved as .png). Keep the bytes intact and use their actual format.
export async function prepareImageImport(bytes,name){
 const ext=path.extname(name).toLowerCase();
 if(!['.png','.jpg','.jpeg','.webp','.gif','.avif','.svg'].includes(ext))return {bytes,extension:ext};
 if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return {bytes,extension:'.png'};
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return {bytes,extension:'.jpg'};
 if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return {bytes,extension:'.webp'};
 const source=bytes.toString('utf8');
 if(ext!=='.svg'&&!/^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg\b/i.test(source))return {bytes,extension:ext};
 const links=[...source.matchAll(/(?:href|src)\s*=\s*["']([^"']*)["']/gi)].map(match=>match[1].trim());
 const urls=[...source.matchAll(/url\(([^)]*)\)/gi)].map(match=>match[1].trim().replace(/^["']|["']$/g,''));
 if(!/<svg\b/i.test(source)||/<!DOCTYPE|<!ENTITY|<\s*(?:script|foreignObject)\b|\son\w+\s*=/i.test(source)||links.some(link=>!/^#|^data:image\/(?:png|jpe?g|webp);base64,/i.test(link))||/@import/i.test(source)||urls.some(url=>!url.startsWith('#')))throw Error('请使用不含脚本或外部链接的 SVG 图片');
 const metadata=await sharp(bytes,{limitInputPixels:24000000}).metadata();
 if(!metadata.width||!metadata.height||metadata.width*metadata.height>24000000)throw Error('SVG 尺寸无效或过大');
 // A high-resolution transparent fallback works with the existing image,
 // generation and video pipelines. Preserve the vector beside it for code art.
 const raster=await sharp(bytes,{density:Math.min(600,72*4096/Math.max(metadata.width,metadata.height)),limitInputPixels:24000000}).resize({width:4096,height:4096,fit:'inside'}).png().toBuffer();
 return {bytes:raster,extension:'.png',vector:bytes};
}
