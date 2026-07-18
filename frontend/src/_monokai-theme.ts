import { EditorView, HighlightStyle, syntaxHighlighting, tags as t } from "./_codemirror";
import type { Extension } from "./_codemirror";

// Classic Monokai palette.
const bg = "#272822";
const bgLine = "#3e3d32";
const bgSelection = "#49483e";
const fg = "#f8f8f2";
const comment = "#75715e";
const pink = "#f92672"; // keywords, tags, operators
const purple = "#ae81ff"; // numbers, constants
const yellow = "#e6db74"; // strings
const green = "#a6e22e"; // function/class definitions
const cyan = "#66d9ef"; // types, class names when used
const orange = "#fd971f"; // parameters, decorators

const monokaiTheme = EditorView.theme(
    {
        "&": {
            color: fg,
            backgroundColor: bg,
        },
        ".cm-content": {
            caretColor: fg,
        },
        ".cm-cursor, .cm-dropCursor": {
            borderLeftColor: fg,
        },
        "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
            backgroundColor: bgSelection,
        },
        ".cm-activeLine": {
            backgroundColor: bgLine,
        },
        ".cm-activeLineGutter": {
            backgroundColor: bgLine,
        },
        ".cm-gutters": {
            backgroundColor: bg,
            color: comment,
            border: "none",
        },
        ".cm-selectionMatch": {
            backgroundColor: "#3e4d2f",
        },
        ".cm-matchingBracket, .cm-nonmatchingBracket": {
            backgroundColor: bgSelection,
            outline: `1px solid ${comment}`,
        },
        ".cm-tooltip": {
            backgroundColor: bgLine,
            color: fg,
            border: `1px solid ${comment}`,
        },
        ".cm-tooltip-autocomplete ul li[aria-selected]": {
            backgroundColor: bgSelection,
            color: fg,
        },
        ".cm-panels": {
            backgroundColor: bgLine,
            color: fg,
        },
    },
    { dark: true }
);

const monokaiHighlight = HighlightStyle.define([
    { tag: t.comment, color: comment, fontStyle: "italic" },
    { tag: t.lineComment, color: comment, fontStyle: "italic" },
    { tag: t.blockComment, color: comment, fontStyle: "italic" },
    { tag: t.docComment, color: comment, fontStyle: "italic" },
    { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword], color: pink },
    { tag: [t.operator, t.derefOperator, t.compareOperator, t.arithmeticOperator, t.logicOperator], color: pink },
    { tag: [t.string, t.special(t.string), t.character], color: yellow },
    { tag: t.regexp, color: yellow },
    { tag: [t.number, t.integer, t.float], color: purple },
    { tag: [t.bool, t.null, t.atom], color: purple },
    { tag: t.self, color: orange, fontStyle: "italic" },
    { tag: [t.definition(t.function(t.variableName)), t.function(t.definition(t.variableName))], color: green },
    { tag: t.definition(t.variableName), color: fg },
    { tag: t.function(t.variableName), color: green },
    { tag: [t.className, t.definition(t.className)], color: cyan },
    { tag: t.propertyName, color: cyan },
    { tag: t.attributeName, color: green },
    { tag: t.variableName, color: fg },
    { tag: t.punctuation, color: fg },
    { tag: [t.bracket, t.paren, t.squareBracket, t.brace], color: fg },
    { tag: t.angleBracket, color: fg },
    { tag: t.meta, color: comment },
    { tag: t.invalid, color: "#f8f8f0", backgroundColor: pink },
]);

const monokai: Extension = [monokaiTheme, syntaxHighlighting(monokaiHighlight)];

export { monokai };
