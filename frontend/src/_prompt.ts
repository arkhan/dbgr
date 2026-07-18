import { Log } from "./_base";
import { History } from "./_history";
import { Dbgr } from "./dbgr";
import {
    EditorState,
    EditorView,
    Compartment,
    StateField,
    StateEffect,
    RangeSet,
    Decoration,
    DecorationSet,
    highlightActiveLine,
    drawSelection,
    highlightSpecialChars,
    keymap,
    defaultKeymap,
    historyKeymap,
    insertNewlineAndIndent,
    deleteToLineEnd,
    deleteGroupBackward,
    cursorLineUp,
    cursorLineDown,
    python,
    autocompletion,
    startCompletion,
    completionStatus,
    indentUnit,
} from "./_codemirror";
import type {
    Extension,
    Range,
    ViewUpdate,
    CompletionContext,
    CompletionResult,
    Completion,
} from "./_codemirror";
import { monokai } from "./_monokai-theme";
import "./scss/_prompt.scss";

const setSearchHighlightEff = StateEffect.define<RegExp | null>();

const searchHighlightField = StateField.define<DecorationSet>({
    create() {
        return Decoration.none;
    },
    update(deco, tr) {
        for (const eff of tr.effects) {
            if (eff.is(setSearchHighlightEff)) {
                if (eff.value === null) {
                    return Decoration.none;
                }
                const re = eff.value;
                const marks: Range<Decoration>[] = [];
                const text = tr.state.doc.toString();
                re.lastIndex = 0;
                let match: RegExpExecArray;
                while ((match = re.exec(text)) !== null) {
                    if (match[0].length === 0) break;
                    marks.push(
                        Decoration.mark({ class: "cm-searching" }).range(
                            match.index,
                            match.index + match[0].length
                        )
                    );
                }
                return RangeSet.of(marks);
            }
        }
        return deco.map(tr.changes);
    },
    provide: (f) => EditorView.decorations.from(f),
});

class Prompt extends Log {
    public dbgr: Dbgr;
    public $container: JQuery;
    public history: any;
    public view: EditorView;
    public $code_mirror: JQuery;
    private readOnlyCmp: Compartment;
    private pendingCompletionResolve: ((result: CompletionResult | null) => void) | null;
    private completionTokFrom: number;

    constructor(dbgr: any) {
        super();
        this.dbgr = dbgr;
        this.$container = $(".prompt");
        this.history = new History(this);
        this.pendingCompletionResolve = null;
        this.completionTokFrom = 0;
        this.readOnlyCmp = new Compartment();

        const jediSource = async (context: CompletionContext): Promise<CompletionResult | null> => {
            const state = context.state;
            const pos = context.pos;
            const text = state.doc.toString();

            if (!text) return null;
            if (text.startsWith(".") && text.length === 2) return null;

            if (text === ".") {
                const commands: Record<string, string> = {
                    a: "History", b: "Break", c: "Continue", d: "Dump",
                    e: "Edition", f: "Find", g: "Clear", h: "Help",
                    i: "Display", j: "Jump", k: "Clear", l: "Breakpoints",
                    m: "Restart", n: "Next", o: "Open", q: "Quit",
                    r: "Return", s: "Step", t: "Tbreak", u: "Until",
                    w: "Watch", x: "Diff", z: "Unbreak",
                };
                return {
                    from: pos,
                    options: Object.entries(commands).map(([key, help]) => ({
                        label: "." + key,
                        displayLabel: `.${key} (${help})`,
                    })),
                };
            }

            if (!context.explicit) {
                const before = context.matchBefore(/[\w\.\(\[\{]+/);
                if (!before) return null;
            }

            const match = context.matchBefore(/\w+/);
            const tokFrom = match ? match.from : pos;
            this.completionTokFrom = tokFrom;

            const line = state.doc.lineAt(pos);
            const lineNo = line.number;
            const ch = pos - line.from;

            if (this.pendingCompletionResolve) {
                this.pendingCompletionResolve(null);
                this.pendingCompletionResolve = null;
            }

            this.dbgr.ws.send("Complete", {
                source: text,
                pos,
                line: lineNo,
                column: ch,
                manual: context.explicit,
            });

            return new Promise<CompletionResult | null>((resolve) => {
                this.pendingCompletionResolve = resolve;
            });
        };

        const promptKeymap = keymap.of([
            {
                key: "Enter",
                run: (view: EditorView) => {
                    this.newLineOrExecute(view);
                    return true;
                },
            },
            {
                key: "ArrowUp",
                run: () => {
                    this.history.up();
                    return true;
                },
            },
            {
                key: "ArrowDown",
                run: () => {
                    this.history.down();
                    return true;
                },
            },
            {
                key: "Ctrl-c",
                run: () => {
                    this.abort();
                    return true;
                },
            },
            {
                key: "Ctrl-d",
                run: () => {
                    if (!this.get()) {
                        this.dbgr.die();
                        return true;
                    }
                    return false;
                },
            },
            { key: "Ctrl-f", run: () => true },
            {
                key: "Ctrl-r",
                run: () => {
                    this.searchBack(true);
                    return true;
                },
            },
            {
                key: "Ctrl-s",
                run: () => {
                    this.searchBack(false);
                    return true;
                },
            },
            { key: "Ctrl-k", run: deleteToLineEnd },
            {
                key: "Ctrl-l",
                run: () => {
                    this.dbgr.cls();
                    return true;
                },
            },
            { key: "Ctrl-Enter", run: insertNewlineAndIndent },
            { key: "Alt-Backspace", run: deleteGroupBackward },
            {
                key: "Ctrl-Space",
                run: (view: EditorView) => {
                    startCompletion(view);
                    return true;
                },
            },
            {
                key: "Ctrl-ArrowUp",
                run: () => {
                    this.insertHistory("up");
                    return true;
                },
            },
            {
                key: "Ctrl-ArrowDown",
                run: () => {
                    this.insertHistory("down");
                    return true;
                },
            },
            { key: "PageUp", run: cursorLineUp },
            { key: "PageDown", run: cursorLineDown },
            {
                key: "Shift-PageUp",
                run: () => {
                    this.dbgr.interpreter.scroll(-1);
                    return true;
                },
            },
            {
                key: "Shift-PageDown",
                run: () => {
                    this.dbgr.interpreter.scroll(1);
                    return true;
                },
            },
            {
                key: "Tab",
                run: (view: EditorView) => {
                    const state = view.state;
                    const pos = state.selection.main.head;
                    const line = state.doc.lineAt(pos);
                    const textBefore = state.sliceDoc(line.from, pos);
                    if (textBefore.trim()) {
                        startCompletion(view);
                        return true;
                    }
                    const indentStr = state.facet(indentUnit) || "    ";
                    view.dispatch(state.replaceSelection(indentStr));
                    return true;
                },
            },
        ]);

        const extensions: Extension[] = [
            promptKeymap,
            keymap.of([...defaultKeymap, ...historyKeymap]),
            python(),
            monokai,
            highlightActiveLine(),
            drawSelection(),
            highlightSpecialChars(),
            EditorView.lineWrapping,
            searchHighlightField,
            autocompletion({
                override: [jediSource],
                activateOnTyping: true,
            }),
            EditorView.updateListener.of((update: ViewUpdate) => {
                if (update.docChanged) {
                    this.changes();
                }
            }),
            this.readOnlyCmp.of(EditorState.readOnly.of(false)),
        ];

        const state = EditorState.create({
            doc: "",
            extensions,
        });

        const domContainer = document.createElement("div");
        this.view = new EditorView({ state, parent: domContainer });
        this.$code_mirror = $(this.view.dom);
        this.$container.prepend(domContainer);
        this.view.focus();
    }

    addSearchHighlight(re: RegExp): void {
        this.view.dispatch({ effects: setSearchHighlightEff.of(re) });
    }

    removeSearchHighlight(): void {
        this.view.dispatch({ effects: setSearchHighlightEff.of(null) });
    }

    complete(data: any) {
        if (data.completions && this.pendingCompletionResolve) {
            const resolve = this.pendingCompletionResolve;
            this.pendingCompletionResolve = null;
            const from = this.completionTokFrom;
            resolve({
                from,
                options: Array.from(data.completions).map((c: any) => ({
                    label: c.base + c.complete,
                })),
            });
            return;
        }

        if (data.imports) {
            if (this.pendingCompletionResolve) {
                const resolve = this.pendingCompletionResolve;
                this.pendingCompletionResolve = null;
                resolve({
                    from: 0,
                    options: Array.from(data.imports).map((imp: string) => ({
                        label: imp,
                    })),
                });
            }
        }
    }

    triggerAutocomplete() {
        startCompletion(this.view);
    }

    newLineOrExecute(view: EditorView) {
        const snippet = view.state.doc.toString().trim();
        if (!snippet) return;
        view.dispatch({
            effects: this.readOnlyCmp.reconfigure(EditorState.readOnly.of(true)),
        });
        this.$container.addClass("loading");
        this.dbgr.execute(snippet);
    }

    focus() {
        return this.view.focus();
    }

    focused() {
        return this.view.hasFocus;
    }

    abort() {
        this.history.reset();
        return this.set("");
    }

    ready(newline: any) {
        if (newline == null) {
            newline = false;
        }
        if (newline) {
            insertNewlineAndIndent(this.view);
        } else {
            const snippet = this.view.state.doc.toString().trim();
            this.history.historize(snippet);
            this.history.reset();
            this.set("");
        }
        return this.unlock();
    }

    unlock() {
        this.$container.removeClass("loading");
        this.view.dispatch({
            effects: this.readOnlyCmp.reconfigure(EditorState.readOnly.of(false)),
        });
        return this.focus();
    }

    get() {
        return this.view.state.doc.toString();
    }

    set(val: string) {
        const doc = this.view.state.doc;
        this.view.dispatch({
            changes: { from: 0, to: doc.length, insert: val },
        });
    }

    leftpad(str: any, n: any, c?: any) {
        if (c == null) {
            c = " ";
        }
        const p = n - str.length;
        for (
            let i = 0, end = p, asc = 0 <= end;
            asc ? i <= end : i >= end;
            asc ? i++ : i--
        ) {
            str = c + str;
        }
        return str;
    }

    searchBack(back?: any) {
        if (back == null) {
            back = true;
        }
        this.$code_mirror.addClass("extra-dialog");

        const container = this.view.dom.parentElement;
        const dialog = document.createElement("div");
        dialog.className = "dbgr-history-search";

        const titleEl = document.createElement("span");
        titleEl.className = "search-dialog-title";
        titleEl.textContent = `Search ${back ? "backward" : "forward"}:`;

        const input = document.createElement("input");
        input.type = "text";
        input.className = "dbgr-search-field";
        input.style.width = "10em";

        dialog.appendChild(titleEl);
        dialog.appendChild(input);
        container.appendChild(dialog);

        let closed = false;
        const closeData = { back };

        const closeDialog = () => {
            if (closed) return;
            closed = true;
            this.history.rollbackSearch();
            container.removeChild(dialog);
            this.$code_mirror.removeClass("extra-dialog");
        };

        const commitDialog = () => {
            if (closed) return;
            closed = true;
            this.history.commitSearch();
            container.removeChild(dialog);
            this.$code_mirror.removeClass("extra-dialog");
        };

        input.addEventListener("input", () => {
            const val = input.value;
            if (!val) return;
            this.history.resetSearch();
            input.classList.toggle(
                "not-found",
                !!(val && !this.history[closeData.back ? "searchNext" : "searchPrev"](val))
            );
        });

        input.addEventListener("keydown", (e: KeyboardEvent) => {
            const val = input.value;
            if (e.key === "Enter") {
                commitDialog();
            } else if (
                (e.keyCode === 82 && e.ctrlKey) ||
                (e.keyCode === 83 && e.altKey)
            ) {
                closeData.back = true;
                titleEl.textContent = "Search backward:";
                input.classList.toggle("not-found", !!(val && !this.history.searchNext(val)));
                e.preventDefault();
                e.stopPropagation();
            } else if (
                (e.keyCode === 83 && e.ctrlKey) ||
                (e.keyCode === 82 && e.altKey)
            ) {
                closeData.back = false;
                titleEl.textContent = "Search forward:";
                input.classList.toggle("not-found", !!(val && !this.history.searchPrev(val)));
                e.preventDefault();
                e.stopPropagation();
            } else if (e.ctrlKey && e.key === "c") {
                closeDialog();
            } else if (e.key === "Escape") {
                closeDialog();
            }
        });

        input.focus();
    }

    insert(str: any) {
        const pos = this.view.state.selection.main.head;
        this.view.dispatch({
            changes: { from: pos, insert: str },
        });
    }

    changes() {
        return window.setTimeout(() => this.dbgr.interpreter.scroll());
    }

    insertHistory(direction: string) {
        const h = this.history.getHistory(direction).reverse().join("\n");
        this.history.reset();
        return this.set(h);
    }
}

export { Prompt };
