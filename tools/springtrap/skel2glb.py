# Skinned USDZ (UsdSkel, Sketchfab export) -> GLB for Nightbound: one skin, bind-pose joints, textures
# downscaled to TEX px (baseColor, normal, metal+rough packed, emissive). Animations are dropped (the
# game poses the joints itself). usage: skel2glb.py scene.usdc out.glb [TEX] [names.json]
import sys, json, struct, io, os
import numpy as np
from pxr import Usd, UsdGeom, UsdSkel, UsdShade, Gf
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
TEX = int(sys.argv[3]) if len(sys.argv) > 3 else 512
NAMES = json.load(open(sys.argv[4])) if len(sys.argv) > 4 else {}
st = Usd.Stage.Open(src)
skel = next(p for p in st.Traverse() if p.GetTypeName() == 'Skeleton'); S = UsdSkel.Skeleton(skel)
joints = list(S.GetJointsAttr().Get()); nj = len(joints)
bind = [np.array(m, dtype=np.float64) for m in S.GetBindTransformsAttr().Get()]   # row-vector, skeleton space
rest = [np.array(m, dtype=np.float64) for m in S.GetRestTransformsAttr().Get()]   # local
parent = [joints.index(j.rsplit('/', 1)[0]) if '/' in j else -1 for j in joints]
# a joint bound at the origin under a parent that isn't (a broken export): give it a bind from its rest
# offset. Skinning is unchanged (its inverse bind follows), but it now turns about the right pivot.
for i in range(nj):
    if parent[i] >= 0 and np.linalg.norm(bind[i][3, :3]) < 1e-3 and np.linalg.norm(bind[parent[i]][3, :3]) > 1: bind[i] = rest[i] @ bind[parent[i]]
world = np.array(UsdGeom.Xformable(skel).ComputeLocalToWorldTransform(0), dtype=np.float64)
# local transforms from the bind pose (so the GLB rests exactly in its bind pose)
local = [bind[i] @ np.linalg.inv(bind[parent[i]]) if parent[i] >= 0 else bind[i] for i in range(nj)]
def trs(M):
    t = M[3, :3].copy(); R = M[:3, :3].copy(); s = np.linalg.norm(R, axis=1); R = R / s[:, None]
    q = Gf.Matrix3d(*R.flatten().tolist()).ExtractRotation().GetQuat()
    # USD row-vector rotation == transpose of column-vector rotation: Gf already accounts for that
    return t.tolist(), [*q.GetImaginary(), q.GetReal()], s.tolist()
bufs = bytearray(); views = []; accs = []
def add(arr, target=None, comp=5126, typ='VEC3', norm=False, minmax=False):
    a = np.ascontiguousarray(arr); 
    while len(bufs) % 4: bufs.append(0)
    off = len(bufs); bufs.extend(a.tobytes()); v = {'buffer': 0, 'byteOffset': off, 'byteLength': a.nbytes}
    if target: v['target'] = target
    views.append(v)
    acc = {'bufferView': len(views) - 1, 'componentType': comp, 'count': len(a), 'type': typ}
    if norm: acc['normalized'] = True
    if minmax: acc['min'] = a.min(0).tolist(); acc['max'] = a.max(0).tolist()
    accs.append(acc); return len(accs) - 1
images = []; textures = []; materials = []; matidx = {}
def img(path, mode='RGB', keepAlpha=False):
    im = Image.open(path); im = im.convert('RGBA' if keepAlpha else mode)
    if max(im.size) > TEX: im = im.resize((TEX, TEX * im.size[1] // im.size[0]), Image.LANCZOS)
    return im
def addimg(im, png=False):
    b = io.BytesIO(); (im.save(b, 'PNG', optimize=True) if png else im.convert('RGB').save(b, 'JPEG', quality=82))
    while len(bufs) % 4: bufs.append(0)
    off = len(bufs); bufs.extend(b.getvalue()); views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(b.getvalue())})
    images.append({'bufferView': len(views) - 1, 'mimeType': 'image/png' if png else 'image/jpeg'}); textures.append({'source': len(images) - 1}); return len(textures) - 1
def material(mat):
    name = mat.GetPrim().GetName()
    if name in matidx: return matidx[name]
    tex = {}; emis = None
    for s in mat.GetPrim().GetChildren():
        sh = UsdShade.Shader(s); f = sh.GetInput('file')
        if f and f.Get(): tex[s.GetName()] = f.Get().resolvedPath
        if s.GetName() == 'pbr_shader': e = sh.GetInput('emissiveColor'); emis = e.Get() if e else None
    m = {'name': name, 'pbrMetallicRoughness': {'metallicFactor': 1, 'roughnessFactor': 1}}
    if 'tex_base' in tex:
        b = Image.open(tex['tex_base']); alpha = b.mode in ('RGBA', 'LA', 'P') and np.array(b.convert('RGBA'))[..., 3].min() < 250
        m['pbrMetallicRoughness']['baseColorTexture'] = {'index': addimg(img(tex['tex_base'], keepAlpha=alpha), png=alpha)}
        if alpha: m['alphaMode'] = 'MASK'; m['alphaCutoff'] = 0.4; m['doubleSided'] = True
    else: m['pbrMetallicRoughness']['baseColorFactor'] = [0.15, 0.13, 0.12, 1]; m['pbrMetallicRoughness']['metallicFactor'] = 0.2; m['pbrMetallicRoughness']['roughnessFactor'] = 0.6
    if 'tex_normal' in tex: m['normalTexture'] = {'index': addimg(img(tex['tex_normal']))}
    if 'tex_roughness' in tex or 'tex_metallic' in tex:
        R = img(tex['tex_roughness'], 'L') if 'tex_roughness' in tex else None
        Mt = img(tex['tex_metallic'], 'L') if 'tex_metallic' in tex else None
        sz = (R or Mt).size; z = Image.new('L', sz, 0)
        m['pbrMetallicRoughness']['metallicRoughnessTexture'] = {'index': addimg(Image.merge('RGB', (z, (R or Image.new('L', sz, 200)).resize(sz), (Mt or z).resize(sz))))}
        if 'tex_metallic' not in tex: m['pbrMetallicRoughness']['metallicFactor'] = 0
    if 'tex_emissive' in tex: m['emissiveTexture'] = {'index': addimg(img(tex['tex_emissive']))}; m['emissiveFactor'] = [1, 1, 1]
    materials.append(m); matidx[name] = len(materials) - 1; return matidx[name]
meshes = []; mesh_nodes = []
def wq(W):
    # weights as normalized bytes that still sum to exactly 255
    q = np.floor(W * 255).astype(np.int64); r = 255 - q.sum(1); q[np.arange(len(q)), W.argmax(1)] += r
    return q.astype(np.uint8)
for p in st.Traverse():
    if p.GetTypeName() != 'Mesh': continue
    m = UsdGeom.Mesh(p); B = UsdSkel.BindingAPI(p)
    P = np.array(m.GetPointsAttr().Get(), dtype=np.float64)
    gb = B.GetGeomBindTransformAttr().Get(); G = np.array(gb, dtype=np.float64) if gb else np.eye(4)
    P = (np.c_[P, np.ones(len(P))] @ G)[:, :3]
    N = m.GetNormalsAttr().Get(); N = np.array(N, dtype=np.float64) @ G[:3, :3] if N is not None and len(N) == len(P) else None
    if N is not None: N /= np.maximum(1e-9, np.linalg.norm(N, axis=1))[:, None]
    uvp = UsdGeom.PrimvarsAPI(p).GetPrimvar('st0'); UV = np.array(uvp.Get(), dtype=np.float32) if uvp and uvp.Get() is not None else np.zeros((len(P), 2), np.float32)
    UV = UV.copy(); UV[:, 1] = 1 - UV[:, 1]
    es = B.GetJointIndicesPrimvar().GetElementSize()
    JI = np.array(B.GetJointIndicesPrimvar().Get(), dtype=np.int64).reshape(-1, es); JW = np.array(B.GetJointWeightsPrimvar().Get(), dtype=np.float32).reshape(-1, es)
    jm = B.GetJointsAttr().Get()
    if jm: mp = np.array([joints.index(j) for j in jm]); JI = mp[JI]
    if len(JI) == 1: JI = np.repeat(JI, len(P), 0); JW = np.repeat(JW, len(P), 0)
    if es < 4: JI = np.c_[JI, np.zeros((len(P), 4 - es), np.int64)]; JW = np.c_[JW, np.zeros((len(P), 4 - es), np.float32)]
    elif es > 4:
        o = np.argsort(-JW, 1)[:, :4]; JI = np.take_along_axis(JI, o, 1); JW = np.take_along_axis(JW, o, 1)
    JW = JW / np.maximum(1e-9, JW.sum(1))[:, None]
    idx = np.array(m.GetFaceVertexIndicesAttr().Get(), dtype=np.uint32)
    mat = UsdShade.MaterialBindingAPI(p).ComputeBoundMaterial()[0]
    attrs = {'POSITION': add(P.astype(np.float32), 34962, minmax=True), 'TEXCOORD_0': add(UV, 34962, typ='VEC2'),
             'JOINTS_0': add(JI.astype(np.uint8 if nj < 256 else np.uint16), 34962, comp=5121 if nj < 256 else 5123, typ='VEC4'), 'WEIGHTS_0': add(wq(JW), 34962, comp=5121, typ='VEC4', norm=True)}
    if N is not None: attrs['NORMAL'] = add(N.astype(np.float32), 34962)
    prim = {'attributes': attrs, 'indices': add(idx, 34963, comp=5125, typ='SCALAR')}
    if mat: prim['material'] = material(mat)
    meshes.append({'name': p.GetName(), 'primitives': [prim]})
nodes = [{'name': 'SkelRoot', 'matrix': world.flatten().tolist(), 'children': []}]
J0 = 1
for i in range(nj):
    t, r, s = trs(local[i])
    nm = NAMES.get(joints[i].rsplit('/', 1)[-1], joints[i].rsplit('/', 1)[-1])
    nodes.append({'name': nm, 'translation': t, 'rotation': r, 'scale': s})
for i in range(nj):
    if parent[i] >= 0: nodes[J0 + parent[i]].setdefault('children', []).append(J0 + i)
    else: nodes[0]['children'].append(J0 + i)
ibm = np.array([np.linalg.inv(b) for b in bind], dtype=np.float32).reshape(-1, 16)
skin = {'joints': list(range(J0, J0 + nj)), 'inverseBindMatrices': add(ibm, comp=5126, typ='MAT4')}
for k, me in enumerate(meshes):
    nodes.append({'name': me['name'], 'mesh': k, 'skin': 0}); nodes[0]['children'].append(len(nodes) - 1)
gl = {'asset': {'version': '2.0', 'generator': 'nightbound skel2glb'}, 'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': nodes, 'meshes': meshes, 'skins': [skin],
      'materials': materials, 'textures': textures, 'images': images, 'samplers': [], 'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': len(bufs)}]}
while len(bufs) % 4: bufs.append(0)
gl['buffers'][0]['byteLength'] = len(bufs)
js = json.dumps(gl, separators=(',', ':')).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
with open(out, 'wb') as f:
    f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bufs)))
    f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
    f.write(struct.pack('<II', len(bufs), 0x004E4942)); f.write(bufs)
print(out, os.path.getsize(out) // 1024, 'KB', nj, 'joints', sum(len(m['primitives']) for m in meshes), 'meshes')
# joint dump: name, parent, bind world position (skeleton space)
if os.environ.get('DUMP'):
    for i in range(nj): print(joints[i].rsplit('/', 1)[-1], parent[i] >= 0 and joints[parent[i]].rsplit('/', 1)[-1], np.round(bind[i][3, :3], 1).tolist())
