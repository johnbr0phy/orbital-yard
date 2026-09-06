// CPU mesh handles for the unchanged forge/damage bookkeeping. This is not a
// WebGL context: Three.js alone owns the GPU and all drawing on the new page.
export function createGeometryStore(){
 let vao=null,array=null,index=null,nextConstant=1;
 const constants=new Map();const noop=()=>{};
 const api={createVertexArray:()=>({attributes:{},index:null}),createBuffer:()=>({data:null,version:0}),
 bindVertexArray(v){vao=v;index=v?.index||null},
 bindBuffer(target,b){if(target===gl.ARRAY_BUFFER)array=b;else if(target===gl.ELEMENT_ARRAY_BUFFER){index=b;if(vao)vao.index=b}},
 bufferData(target,data){const b=target===gl.ARRAY_BUFFER?array:index;if(!b)return;b.data=typeof data==='number'?new Uint8Array(data):data.slice();b.version++},
 bufferSubData(target,offset,data,srcOffset=0,length){const b=target===gl.ARRAY_BUFFER?array:index;if(!b?.data)return;const view=data.subarray(srcOffset,length==null?data.length:srcOffset+length);new Uint8Array(b.data.buffer,b.data.byteOffset,b.data.byteLength).set(new Uint8Array(view.buffer,view.byteOffset,view.byteLength),offset);b.version++},
 vertexAttribPointer(location,size,type,normalized,stride,offset){if(vao)vao.attributes[location]={buffer:array,size,stride,offset}},
 deleteBuffer(b){if(b){b.data=null;b.version++}},deleteVertexArray(v){if(v)v.deleted=true},
 createProgram:()=>({}),createShader:()=>({}),getUniformLocation:()=>({}),getShaderParameter:()=>true,getProgramParameter:()=>true};
 const gl=new Proxy(api,{get(target,key){if(key in target)return target[key];if(/^[A-Z_0-9]+$/.test(key)){if(!constants.has(key))constants.set(key,nextConstant++);return constants.get(key)}return noop}});
 return {gl,geometry(handle){if(!handle||handle.deleted)return null;const v=handle.attributes?.[0]?.buffer,i=handle.index;if(!v?.data||!i?.data)return null;return {v:v.data,i:i.data,version:v.version+i.version}}};
}
