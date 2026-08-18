import { toast } from "svelte-sonner";

import { EXPORT_STYLE_PROPERTIES, MAX_CANVAS_AREA, MAX_CANVAS_DIMENSION } from "$lib/constants/visualisation";
import type { Node } from "$lib/types/graph";

function getUsableScale(width: number, height: number, mime: "png" | "jpg"): number | null {
	for (const scale of [2, 1]) {
		const w = width * scale;
		const h = height * scale;
		if (w <= MAX_CANVAS_DIMENSION && h <= MAX_CANVAS_DIMENSION && w * h <= MAX_CANVAS_AREA) return scale;
	}

	toast.error(`Graph too large to export as ${mime.toUpperCase()}`);
	return null;
}

export function downloadBlob(content: string, filename: string, mime: string): void {
	downloadBlobObject(new Blob([content], { type: mime }), filename);
}

function downloadBlobObject(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");

	a.href = url;
	a.download = filename;

	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);

	URL.revokeObjectURL(url);
}

function buildExportSvg(
	svgEl: SVGSVGElement,
	nodes: Node[],
	transform: { x: number; y: number; k: number }
): { svg: string; width: number; height: number } {
	const padding = 40;
	const dims = nodes.map((n) => ({
		x: n.x * transform.k + transform.x,
		y: n.y * transform.k + transform.y,
		w: n.width * transform.k,
		h: n.height * transform.k
	}));
	const minX = Math.min(...dims.map((d) => d.x)) - padding;
	const minY = Math.min(...dims.map((d) => d.y)) - padding;
	const maxX = Math.max(...dims.map((d) => d.x + d.w)) + padding;
	const maxY = Math.max(...dims.map((d) => d.y + d.h)) + padding;

	const rootEl = document.documentElement;
	const wasDark = rootEl.classList.contains("dark");
	if (wasDark) rootEl.classList.remove("dark");

	const out = svgEl.cloneNode(true) as SVGSVGElement;
	const originals = svgEl.querySelectorAll("*");
	const clones = out.querySelectorAll("*");

	try {
		clones.forEach((el, i) => {
			const cs = getComputedStyle(originals[i]);
			for (const prop of EXPORT_STYLE_PROPERTIES) {
				const val = cs.getPropertyValue(prop);
				if (val) (el as SVGElement).style.setProperty(prop, val);
			}
		});
	} finally {
		if (wasDark) rootEl.classList.add("dark");
	}

	out.setAttribute("viewBox", `${minX} ${minY} ${maxX - minX} ${maxY - minY}`);
	out.setAttribute("width", String(maxX - minX));
	out.setAttribute("height", String(maxY - minY));

	return {
		svg: new XMLSerializer().serializeToString(out),
		width: maxX - minX,
		height: maxY - minY
	};
}

export function exportSvg(svgEl: SVGSVGElement, nodes: Node[], transform: { x: number; y: number; k: number }) {
	if (!svgEl || nodes.length === 0) return;

	const { svg } = buildExportSvg(svgEl, nodes, transform);
	const filename = `carapace_${new Date().toISOString().slice(0, 10)}.svg`;
	downloadBlob(svg, filename, "image/svg+xml;charset=utf-8");
}

export function exportRaster(
	svgEl: SVGSVGElement,
	nodes: Node[],
	transform: { x: number; y: number; k: number },
	mime: "png" | "jpg"
) {
	if (!svgEl || nodes.length === 0) return;

	const { svg, width, height } = buildExportSvg(svgEl, nodes, transform);
	const filename = `carapace_${new Date().toISOString().slice(0, 10)}.${mime}`;
	const scale = getUsableScale(width, height, mime);
	if (!scale) return;

	const img = new Image();
	img.onload = () => {
		const canvas = document.createElement("canvas");
		canvas.width = width * scale;
		canvas.height = height * scale;
		const ctx = canvas.getContext("2d");
		if (!ctx) {
			toast.error(`Failed to render ${mime.toUpperCase()} export. Try different format`);
			return;
		}

		// JPG doesn't support transparency, PNG does
		if (mime === "jpg") {
			ctx.fillStyle = "#ffffff";
			ctx.fillRect(0, 0, canvas.width, canvas.height);
		}

		ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
		canvas.toBlob(
			(blob) => {
				if (!blob) {
					toast.error(`Failed to render ${mime.toUpperCase()} export. Try different format`);
					return;
				}
				downloadBlobObject(blob, filename);
			},
			mime === "jpg" ? "image/jpeg" : "image/png",
			0.92
		);
	};
	img.onerror = () => toast.error(`Failed to render ${mime.toUpperCase()} export. Try different format`);
	img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
