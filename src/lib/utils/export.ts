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

const EXPORT_STYLE_PROPERTIES = [
	"fill",
	"stroke",
	"stroke-width",
	"font-size",
	"font-family",
	"font-weight",
	"text-anchor",
	"paint-order",
	"opacity",
	"stroke-linejoin",
	"stroke-linecap",
	"filter"
];

function inlineStyles(clone: Element, original: Element) {
	const cs = window.getComputedStyle(original);
	for (const prop of EXPORT_STYLE_PROPERTIES) {
		const value = cs.getPropertyValue(prop);
		if (value && value !== "none" && value !== "normal" && value !== "0px" && value !== "0px 0px 0px 0px") {
			(clone as SVGElement).style.setProperty(prop, value);
		}
	}
	for (let i = 0; i < clone.children.length && i < original.children.length; i++) {
		inlineStyles(clone.children[i], original.children[i]);
	}
}

export function exportSvgToFile(svgEl: SVGSVGElement, nodes: Node[], transform: { x: number; y: number; k: number }) {
	if (!svgEl || nodes.length === 0) return;

	const padding = 40;
	const screenX = (x: number) => x * transform.k + transform.x;
	const screenY = (y: number) => y * transform.k + transform.y;
	const dimensions = nodes.map((n) => ({
		x: screenX(n.x),
		y: screenY(n.y),
		w: n.width * transform.k,
		h: n.height * transform.k
	}));
	const minX = Math.min(...dimensions.map((d) => d.x)) - padding;
	const minY = Math.min(...dimensions.map((d) => d.y)) - padding;
	const maxX = Math.max(...dimensions.map((d) => d.x + d.w)) + padding;
	const maxY = Math.max(...dimensions.map((d) => d.y + d.h)) + padding;
	const boxW = maxX - minX;
	const boxH = maxY - minY;

	const out = svgEl.cloneNode(true) as SVGSVGElement;
	inlineStyles(out, svgEl);
	out.setAttribute("viewBox", `${minX} ${minY} ${boxW} ${boxH}`);
	out.setAttribute("width", String(boxW));
	out.setAttribute("height", String(boxH));

	const svgDoc = new XMLSerializer().serializeToString(out);
	downloadBlob(svgDoc, "graph.svg", "image/svg+xml;charset=utf-8");
}
