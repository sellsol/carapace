<script lang="ts">
	import { Compartment, EditorState } from "@codemirror/state";
	import { catppuccinMocha } from "@fsegurai/codemirror-theme-catppuccin-mocha";
	import { materialLight } from "@fsegurai/codemirror-theme-material-light";
	import { EditorView, basicSetup } from "codemirror";
	import { turtle } from "codemirror-lang-turtle";
	import { mode } from "mode-watcher";
	import { onMount } from "svelte";

	interface Props {
		value: string;
		lockedMode?: boolean;
	}
	let { value = $bindable(""), lockedMode = false }: Props = $props();

	let editorElement: HTMLDivElement;
	let editorView: EditorView;
	let skipNextUpdate = false;
	const editableCompartment = new Compartment();

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
		}
	});

	const createExtensions = () => {
		const extensions = [
			basicSetup,
			turtle(),
			EditorView.updateListener.of((update) => {
				if (update.docChanged && !skipNextUpdate) {
					value = update.state.doc.toString();
				}
			}),
			editorTheme
		];
		extensions.splice(2, 0, mode.current === "dark" ? catppuccinMocha : materialLight);
		extensions.push(editableCompartment.of(EditorView.editable.of(!lockedMode)));

		return extensions;
	};

	onMount(() => {
		const state = EditorState.create({
			doc: value,
			extensions: createExtensions()
		});

		editorView = new EditorView({
			state,
			parent: editorElement
		});

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

<div
	bind:this={editorElement}
	class="h-full w-full overflow-hidden"
	style="display: flex; flex-direction: column;"
></div>
