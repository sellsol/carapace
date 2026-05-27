# Carapace

**Turtle (TTL) ontology editor and graph visualiser.**

Edit TTL to see entities, relationships, and inheritance hierarchies updated on a good-looking graph in real time. Force graph computations are used to load an initial spread of nodes, which can be rearranged manually through dragging.

Nodes are automatically classified into the entity types: Class, Datatype, Object Property, Data Property, Annotation Property, Instance (named individuals), and Literal.

![sample.png](docs/screenshots/sample.png)

## Features

- **Live Visualisation Updates:** Code editor updates the associated nodes in the graph as changes are made.
- **Syntax Highlighting:** Turtle file syntax highlighting supported by Codemirror.
- **Multiple Files:** Easily switch between multiple TTL files with independent graph settings.
- **Session Persistence:** Tabs, settings, and node positions are saved to localStorage and restored on reload.
- **Graph Controls:** Pan, zoom and scroll within the graph visualisation. Drag nodes to manually rearrange.
- **Lock Positions:** Freeze node positions to maintain a manually arranged layout across tab switches.
- **Fine-Grained Visualiser Settings:** Toggle visibility of nodes by entity types, and blacklist namespaces, predicates, or instances of types.
- **External Node Handling:** Marks nodes from external vocabularies with distinct colours and node headers. Settings allow toggling of external nodes duplication for a cleaner graph.
- **Export as CSV:** Export to a high-quality visualisation that fits to the graph's bounding box.
- **Export/ Import State:** Export and import the state of tabs to save the state of the graph exactly to pick up where you left off.
- **Light/ Dark Mode:** Good looking light and dark modes.

## Architecture

- **Framework:** Svelte 5 and SvelteKit
- **Graph:** D3.js Force Graph with some manual calculations and handling for optimised performance
- **Code Editor:** CodeMirror 6 with Turtle plugin and editor themes
- **Turtle:** N3.js Turtle parser
- **UI:** Shadcn-Svelte via Bits-UI, Paneforge for pane resizing, Svelte-Lucide for icons

## Roadmap

- **Capability Catalogue:** Browser of pre-configured TTL content and visualisations that comprehensively cover RDF/TTL capabilities. For demonstration and behaviour documentation purposes.
- **Lasso/ Box Select and Drag:** Allow multiple nodes to be selected and moved at once.
- **Line to Node Sync:** Button to pan to node corresponding to current line in code editor.
- **Rich Blank Nodes Rendering:** Various visualisation changes for patterns that are confusing to look at as blank nodes (RDF lists, OWL restrictions, etc.), such as additional node entity types, special shapes, colours or visual groupings that may provide more readability.
- **RDF/ XML Import:** Import RDF/ XML file as an alternative to TTL file import.
- **Setting Whitelists:** Alternative to current settings lists, allowing the user to whitelist instead of blacklist namespaces, predicates, etc.
