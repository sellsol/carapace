import { EXPORT_STYLE_PROPERTIES } from "$lib/constants/visualisation";
import type { Node } from "$lib/types/graph";

export function downloadBlob(content: string, filename: string, mime: string): void {
	const blob = new Blob([content], { type: mime });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");

	a.href = url;
	a.download = filename;

	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);

	URL.revokeObjectURL(url);
}

export function exportSvg(svgEl: SVGSVGElement, nodes: Node[], transform: { x: number; y: number; k: number }) {
	if (!svgEl || nodes.length === 0) return;

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

	const out = svgEl.cloneNode(true) as SVGSVGElement;
	const originals = svgEl.querySelectorAll("*");
	const clones = out.querySelectorAll("*");
	clones.forEach((el, i) => {
		const cs = getComputedStyle(originals[i]);
		for (const prop of EXPORT_STYLE_PROPERTIES) {
			const val = cs.getPropertyValue(prop);
			if (val) (el as SVGElement).style.setProperty(prop, val);
		}
	});

	out.setAttribute("viewBox", `${minX} ${minY} ${maxX - minX} ${maxY - minY}`);
	out.setAttribute("width", String(maxX - minX));
	out.setAttribute("height", String(maxY - minY));

	const filename = `carapace_${new Date().toISOString().slice(0, 10)}.svg`;
	downloadBlob(new XMLSerializer().serializeToString(out), filename, "image/svg+xml;charset=utf-8");
}
