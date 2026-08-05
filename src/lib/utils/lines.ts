import { Lexer, type Token } from "n3";

export type LineMapping = {
	uriToLine: Map<string, number>;
	lineToUris: Map<number, string[]>;
};

const DECLARATION_TYPES = new Set(["@prefix", "@base", "PREFIX", "BASE"]);
const BLANK_START_TYPES = new Set(["blank", "[", "("]);

export function computeLineMapping(
	content: string,
	prefixMap: Record<string, string>,
	lineMapping?: LineMapping,
	tokens?: Token[]
): LineMapping {
	const uriToLine = lineMapping?.uriToLine ?? new Map<string, number>();
	const lineToUris = lineMapping?.lineToUris ?? new Map<number, string[]>();
	const namespaceByPrefix = reversePrefixMap(prefixMap);

	let subject: string | null = null;
	let predicate: string | null = null;
	let inDeclaration = false;
	let suppressSubject = false;

	const addToUri = (line: number, uri: string) => {
		if (!uriToLine.has(uri)) uriToLine.set(uri, line);
	};

	const addToLine = (line: number, uri: string | null) => {
		if (!uri) return;

		const uris = lineToUris.get(line);
		if (uris) {
			if (uris[uris.length - 1] !== uri) uris.push(uri);
		} else {
			lineToUris.set(line, [uri]);
		}
	};

	const resolveUri = (token: Token): string => {
		if (token.type === "IRI") return token.value ?? "";
		return "" + namespaceByPrefix.get(token.prefix ?? "") + token.value;
	};

	for (const token of tokens ?? new Lexer().tokenize(content)) {
		if (token.type === ";") {
			predicate = null;
		} else if (token.type === ".") {
			addToLine(token.line, subject);
			subject = null;
			predicate = null;
			suppressSubject = false;
		} else if (DECLARATION_TYPES.has(token.type)) {
			inDeclaration = true;
		} else if (BLANK_START_TYPES.has(token.type) && !subject) {
			suppressSubject = true;
		} else if (token.type === "prefixed" || token.type === "IRI") {
			if (inDeclaration) {
				inDeclaration = false;
			} else if (!suppressSubject) {
				const uri = resolveUri(token);
				if (!subject) {
					subject = uri;
					addToUri(token.line, uri);
				} else if (!predicate) {
					predicate = uri;
				}
			}
		} else if (token.type === "literal") {
			if (subject && predicate) {
				addToUri(token.line, `${subject}|${predicate}|${token.value}`);
			}
		}

		addToLine(token.line, subject);
	}

	return { uriToLine, lineToUris };
}

function reversePrefixMap(prefixMap: Record<string, string>): Map<string, string> {
	const map = new Map<string, string>();
	for (const [iri, prefix] of Object.entries(prefixMap)) {
		map.set(prefix, iri);
	}
	return map;
}

export function lineForNodeUri(uri: string | null, mapping: LineMapping | null): number | null {
	if (!mapping || !uri) return null;

	const direct = mapping.uriToLine.get(uri);
	if (direct != null) return direct;

	const firstSep = uri.indexOf("|");
	if (firstSep === -1) return null;

	const secondSep = uri.indexOf("|", firstSep + 1);
	if (secondSep === -1) return null;

	return mapping.uriToLine.get(uri.slice(secondSep + 1)) ?? null;
}
