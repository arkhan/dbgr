export { EditorState, Compartment, StateField, StateEffect, RangeSet } from "@codemirror/state";
export type { Extension, Transaction, Range } from "@codemirror/state";
export {
    EditorView,
    Decoration,
    WidgetType,
    gutter,
    GutterMarker,
    lineNumbers,
    highlightActiveLine,
    keymap,
    drawSelection,
    highlightSpecialChars,
    scrollPastEnd,
} from "@codemirror/view";
export type { DecorationSet, ViewUpdate } from "@codemirror/view";
export {
    defaultKeymap,
    historyKeymap,
    indentWithTab,
    insertNewlineAndIndent,
    moveLineDown,
    moveLineUp,
    undo,
    redo,
    selectAll,
    deleteToLineEnd,
    deleteGroupBackward,
    cursorLineUp,
    cursorLineDown,
} from "@codemirror/commands";
export {
    LanguageSupport,
    indentUnit,
    syntaxHighlighting,
    defaultHighlightStyle,
    HighlightStyle,
} from "@codemirror/language";
export { python } from "@codemirror/lang-python";
export {
    autocompletion,
    startCompletion,
    closeCompletion,
    completionStatus,
} from "@codemirror/autocomplete";
export type { Completion, CompletionResult, CompletionContext } from "@codemirror/autocomplete";
export { search, searchKeymap, openSearchPanel } from "@codemirror/search";
export { highlightTree, classHighlighter, tags } from "@lezer/highlight";
