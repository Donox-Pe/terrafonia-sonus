import { useEffect, useRef } from "react";

interface FluxLinesBgProps {
  /** Color principal en RGB normalizado (por defecto rosa neón #FF35D3). */
  primaryColor?: [number, number, number];
  /** Color secundario en RGB normalizado (por defecto violeta neón #8B3DFF). */
  secondaryColor?: [number, number, number];
  /** Intensidad global del brillo (0..1). */
  intensity?: number;
}

const VERT_SRC = /* glsl */ `
  attribute vec2 aPos;
  varying vec2 vUv;
  void main() {
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
  }
`;

const FRAG_SRC = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec2 uMouse;
  uniform float uMouseActive;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uIntensity;

  varying vec2 vUv;

  float hash21(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = rot * p * 2.02;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    float aspect = uResolution.x / max(1.0, uResolution.y);
    vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
    vec2 m = (uMouse - 0.5) * vec2(aspect, 1.0);

    // Interacción magnética del cursor: atrae y curva las líneas de flujo
    vec2 diff = p - m;
    float d = length(diff);
    float magnet = exp(-d * 3.1) * uMouseActive;
    float angle = atan(diff.y, diff.x) + magnet * 2.25;
    vec2 warped = p + vec2(cos(angle), sin(angle)) * (magnet * 0.19);

    // Simulación fluida tipo campo magnético en movimiento
    float t = uTime * 0.22;
    vec2 q = vec2(
      fbm(warped * 2.1 + vec2(t, -t * 0.6)),
      fbm(warped * 2.1 + vec2(-t * 0.7, t * 0.9) + vec2(5.2, 1.3))
    );
    float field = fbm(warped * 2.4 + q * 1.85 + vec2(t * 0.35, -t * 0.25));

    // Líneas de flujo luminosas (contornos magnéticos suaves + núcleo neón)
    float lines1 = abs(fract(field * 13.0 - t * 0.6) - 0.5) * 2.0;
    float lines2 = abs(fract(field * 7.5 + q.x * 1.6 + t * 0.35) - 0.5) * 2.0;

    float strand1 = pow(clamp(1.0 - lines1, 0.0, 1.0), 10.0);
    float strand2 = pow(clamp(1.0 - lines2, 0.0, 1.0), 7.5);
    float glowHalo = pow(clamp(1.0 - lines1, 0.0, 1.0), 2.8) * 0.28;

    float flux = strand1 * 0.95 + strand2 * 0.58 + glowHalo;

    // Paleta rosa neón (#FF35D3) + violeta neón (#8B3DFF) + acento cian en vórtices
    vec3 col = mix(uColorB, uColorA, smoothstep(0.25, 0.78, q.x));
    col = mix(col, vec3(1.0, 0.58, 0.92), strand1 * 0.42);
    col = mix(col, vec3(0.0, 0.85, 1.0), clamp(magnet * 0.45 + strand2 * 0.14, 0.0, 0.55));

    // El cursor revela y potencia sutilmente las líneas cercanas
    float reveal = 0.76 + magnet * 0.65;
    float alpha = clamp(flux * reveal * uIntensity, 0.0, 0.82);

    gl_FragColor = vec4(col * flux * reveal * uIntensity, alpha);
  }
`;

export function FluxLinesBg({
  primaryColor = [1.0, 0.21, 0.83], // #FF35D3 rosa neón
  secondaryColor = [0.55, 0.24, 1.0], // #8B3DFF violeta neón
  intensity = 0.72,
}: FluxLinesBgProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false, antialias: false });
    if (!gl) return;

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type);
      if (!sh) return null;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    };

    const vs = compile(gl.VERTEX_SHADER, VERT_SRC);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG_SRC);
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;

    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, "uTime");
    const uResolution = gl.getUniformLocation(prog, "uResolution");
    const uMouse = gl.getUniformLocation(prog, "uMouse");
    const uMouseActive = gl.getUniformLocation(prog, "uMouseActive");
    const uColorA = gl.getUniformLocation(prog, "uColorA");
    const uColorB = gl.getUniformLocation(prog, "uColorB");
    const uIntensity = gl.getUniformLocation(prog, "uIntensity");

    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, active: 0, targetActive: 0 };
    const onMove = (e: PointerEvent) => {
      mouse.tx = e.clientX / Math.max(1, window.innerWidth);
      mouse.ty = 1 - e.clientY / Math.max(1, window.innerHeight);
      mouse.targetActive = 1;
    };
    const onLeave = () => {
      mouse.targetActive = 0;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);

    const resize = () => {
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.floor(window.innerWidth * dpr));
      const h = Math.max(1, Math.floor(window.innerHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
    };
    resize();
    window.addEventListener("resize", resize);

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    const start = performance.now();
    let raf = 0;

    const render = (now: number) => {
      mouse.x += (mouse.tx - mouse.x) * 0.08;
      mouse.y += (mouse.ty - mouse.y) * 0.08;
      mouse.active += (mouse.targetActive - mouse.active) * 0.06;

      const t = reduced ? 0.5 : (now - start) * 0.001;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.uniform1f(uTime, t);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.uniform1f(uMouseActive, mouse.active);
      gl.uniform3f(uColorA, primaryColor[0], primaryColor[1], primaryColor[2]);
      gl.uniform3f(uColorB, secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      gl.uniform1f(uIntensity, intensity);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!reduced) {
        raf = requestAnimationFrame(render);
      }
    };

    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", resize);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [primaryColor, secondaryColor, intensity]);

  return <canvas ref={canvasRef} className="flux-lines-bg" aria-hidden="true" />;
}
