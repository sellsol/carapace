<script lang="ts">
	import { indentWithTab } from "@codemirror/commands";
	import { indentUnit } from "@codemirror/language";
	import { Compartment, EditorState } from "@codemirror/state";
	import { EditorView, keymap } from "@codemirror/view";
	import { catppuccinMocha } from "@fsegurai/codemirror-theme-catppuccin-mocha";
	import { materialLight } from "@fsegurai/codemirror-theme-material-light";
	import { basicSetup } from "codemirror";
	import { turtle } from "codemirror-lang-turtle";
	import { mode } from "mode-watcher";
	import { onMount } from "svelte";

	import { tabsStore } from "$lib/stores/tabs.svelte";

	interface Props {
		value: string;
		lockedMode?: boolean;
	}
	let { value = $bindable(""), lockedMode = false }: Props = $props();

	let editorElement: HTMLDivElement;
	let editorView: EditorView;
	let skipNextUpdate = false;
	const editableCompartment = new Compartment();

	export function scrollToLine(line: number) {
		if (!editorView) return;

		const doc = editorView.state.doc;
		const targetLine = Math.min(Math.max(line, 1), doc.lines);
		const pos = doc.line(targetLine).from;
		editorView.dispatch({
			selection: { anchor: pos },
			effects: EditorView.scrollIntoView(pos, { y: "center" })
		});
		editorView.focus();
	}

	const editorTheme = EditorView.theme({
		"&": {
			height: "100%",
			display: "flex",
			flexDirection: "column"
		},
		".cm-content": {
			fontSize: "12px",
			lineHeight: "1.6",
			minHeight: "100%"
		},
		".cm-gutters": {
			minHeight: "100%"
		},
		"&.cm-editor .cm-activeLine": {
			border: "0px"
		},
		".cm-selectionBackground": {
			outline: "none"
		},
		".cm-scroller::-webkit-scrollbar-corner": {
			backgroundColor: "var(--base)"
		},
		"&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
			outline: "none"
		}
	});

	function createExtensions() {
		const extensions = [
			basicSetup,
			editorTheme,
			turtle(),
			keymap.of([indentWithTab]),
			indentUnit.of("    "),
			EditorView.updateListener.of((update) => {
				if (update.docChanged && !skipNextUpdate) {
					value = update.state.doc.toString();
				}
				tabsStore.editorCursorLine = update.state.doc.lineAt(update.state.selection.main.head).number;
			})
		];
		extensions.splice(2, 0, mode.current === "dark" ? catppuccinMocha : materialLight);
		extensions.push(editableCompartment.of(EditorView.editable.of(!lockedMode)));

		return extensions;
	}

	onMount(() => {
		const state = EditorState.create({
			doc: value,
			extensions: createExtensions()
		});

		editorView = new EditorView({
			state,
			parent: editorElement
		});

		tabsStore.editorCursorLine = editorView.state.doc.lineAt(editorView.state.selection.main.head).number;

		return () => {
			editorView.destroy();
		};
	});

	$effect(() => {
		const currentValue = value;

		if (!editorView) return;

		const editorContent = editorView.state.doc.toString();
		if (currentValue === editorContent) return;

		skipNextUpdate = true;
		editorView.dispatch({
			changes: {
				from: 0,
				to: editorView.state.doc.length,
				insert: currentValue
			}
		});

		queueMicrotask(() => {
			skipNextUpdate = false;
		});
	});

	$effect(() => {
		if (!editorView) return;

		editorView.dispatch({
			effects: editableCompartment.reconfigure(EditorView.editable.of(!lockedMode))
		});
	});

	$effect(() => {
		if (!editorElement || !editorView) return;

		const currentMode = mode.current;

		return () => {
			if (editorView && mode.current !== currentMode) {
				const currentContent = editorView.state.doc.toString();
				const state = EditorState.create({
					doc: currentContent,
					extensions: createExtensions()
				});
				editorView.setState(state);
			}
		};
	});
</script>

<div bind:this={editorElement} class="h-full w-full overflow-hidden flex flex-col"></div>
