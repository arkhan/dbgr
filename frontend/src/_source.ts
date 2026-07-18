import { Log } from "./_base";
import {
    EditorState, EditorView, Compartment, StateField, StateEffect,
    Decoration, GutterMarker, gutter, lineNumbers, keymap,
    python, LanguageSupport, RangeSet,
} from "./_codemirror";
import type { DecorationSet, Range } from "./_codemirror";
import { monokai } from "./_monokai-theme";
import "./scss/_source.scss";

const addLineClassEff = StateEffect.define<{ lno: number; cls: string }>();
const removeLineClassEff = StateEffect.define<{ lno: number; cls: string }>();
const clearLineDecoEff = StateEffect.define<null>();

type LineClassMap = Map<number, Set<string>>;

function buildLineDeco(map: LineClassMap, doc: any): DecorationSet {
    const ranges: Range<Decoration>[] = [];
    for (const [lno, classes] of map) {
        if (lno < 1 || lno > doc.lines) continue;
        const from = (doc.line(lno) as any).from as number;
        for (const cls of classes) {
            ranges.push(Decoration.line({ class: cls }).range(from));
        }
    }
    ranges.sort((a, b) => a.from - b.from);
    return Decoration.set(ranges, true);
}

const lineDecoField = StateField.define<{ map: LineClassMap; decos: DecorationSet }>({
    create: () => ({ map: new Map(), decos: Decoration.none }),
    update({ map, decos }, tr) {
        let changed = false;
        let newMap = map;
        for (const eff of tr.effects) {
            if (eff.is(clearLineDecoEff)) {
                newMap = new Map();
                changed = true;
            } else if (eff.is(addLineClassEff)) {
                if (!changed) newMap = new Map(newMap);
                changed = true;
                if (!newMap.has(eff.value.lno)) newMap.set(eff.value.lno, new Set());
                newMap.get(eff.value.lno)!.add(eff.value.cls);
            } else if (eff.is(removeLineClassEff)) {
                if (!changed) newMap = new Map(newMap);
                changed = true;
                newMap.get(eff.value.lno)?.delete(eff.value.cls);
            }
        }
        if (!changed) return { map, decos };
        return { map: newMap, decos: buildLineDeco(newMap, tr.state.doc) };
    },
    provide: f => EditorView.decorations.from(f, v => v.decos),
});

class BreakpointMarker extends GutterMarker {
    constructor(
        private readonly char: string,
        private readonly cls: string,
        private readonly title: string,
    ) { super(); }
    toDOM(): Node {
        const el = document.createElement("div");
        el.className = this.cls;
        el.title = this.title;
        el.textContent = this.char;
        return el;
    }
}

class ArrowMarker extends GutterMarker {
    toDOM(): Node {
        const el = document.createElement("div");
        el.className = "highlighted";
        el.textContent = "➤";
        return el;
    }
}

const setBreakMarkerEff = StateEffect.define<{ lno: number; marker: GutterMarker | null }>();

function buildGutterSet(map: Map<number, GutterMarker>, doc: any): RangeSet<GutterMarker> {
    const ranges: Range<GutterMarker>[] = [];
    for (const [lno, marker] of map) {
        if (lno >= 1 && lno <= doc.lines) {
            ranges.push(marker.range((doc.line(lno) as any).from as number));
        }
    }
    ranges.sort((a, b) => a.from - b.from);
    return ranges.length ? RangeSet.of(ranges) : RangeSet.empty;
}

const breaksGutterField = StateField.define<{ map: Map<number, GutterMarker>; set: RangeSet<GutterMarker> }>({
    create: () => ({ map: new Map(), set: RangeSet.empty }),
    update({ map, set }, tr) {
        let changed = false;
        let newMap = map;
        for (const eff of tr.effects) {
            if (eff.is(setBreakMarkerEff)) {
                if (!changed) newMap = new Map(newMap);
                changed = true;
                if (eff.value.marker === null) {
                    newMap.delete(eff.value.lno);
                } else {
                    newMap.set(eff.value.lno, eff.value.marker);
                }
            }
        }
        if (!changed) return { map, set };
        return { map: newMap, set: buildGutterSet(newMap, tr.state.doc) };
    },
});

const setArrowMarkerEff = StateEffect.define<number | null>();

const arrowGutterField = StateField.define<{ lno: number | null; set: RangeSet<GutterMarker> }>({
    create: () => ({ lno: null, set: RangeSet.empty }),
    update({ lno, set }, tr) {
        for (const eff of tr.effects) {
            if (eff.is(setArrowMarkerEff)) {
                const newLno = eff.value;
                if (newLno === null) return { lno: null, set: RangeSet.empty };
                if (newLno >= 1 && newLno <= tr.state.doc.lines) {
                    const from = (tr.state.doc.line(newLno) as any).from as number;
                    return { lno: newLno, set: RangeSet.of([new ArrowMarker().range(from)]) };
                }
                return { lno: null, set: RangeSet.empty };
            }
        }
        return { lno, set };
    },
});

function langExtension(fn: string): LanguageSupport {
    return python();
}

class Source extends Log {
    public wdb: any;
    public $container: JQuery;
    public view: EditorView;
    public $code_mirror: JQuery;
    public state: any;
    public fun_scope: any;
    public footsteps: any;
    public breakpoints: any;

    private _readOnly = true;
    private readonly readOnlyCmp = new Compartment();
    private readonly editableCmp = new Compartment();
    private readonly langCmp = new Compartment();
    private pendingScrollLno: number | null = null;
    private readonly containerResizeObserver: ResizeObserver;

    constructor(wdb: any) {
        super();
        this.wdb = wdb;

        const breaksGutterExt = gutter({
            class: "cm-breaks-gutter",
            markers: (v: EditorView) => v.state.field(breaksGutterField).set,
            domEventHandlers: {
                mousedown: (v: EditorView, line: any, event: Event) => {
                    const lno = v.state.doc.lineAt((line as any).from).number;
                    this.wdb.toggle_break(`:${lno}`);
                    return true;
                },
            },
        });

        const arrowGutterExt = gutter({
            class: "cm-arrow-gutter",
            markers: (v: EditorView) => v.state.field(arrowGutterField).set,
        });

        this.view = new EditorView({
            state: EditorState.create({
                doc: "No active file",
                extensions: [
                    this.readOnlyCmp.of(EditorState.readOnly.of(true)),
                    this.editableCmp.of(EditorView.editable.of(true)),
                    this.langCmp.of(langExtension(".py")),
                    lineNumbers(),
                    breaksGutterExt,
                    arrowGutterExt,
                    lineDecoField,
                    breaksGutterField,
                    arrowGutterField,
                    monokai,
                    keymap.of([
                        { key: "Escape", run: () => { this.stop_edition(); return true; } },
                        { key: "Ctrl-s", run: () => { this.save(); return true; } },
                    ]),
                    EditorView.theme({
                        "&": { display: "flex", flexDirection: "column", flex: "1", minHeight: "0" },
                        ".cm-scroller": { overflow: "auto", flex: "1" },
                    }),
                ],
            }),
        });

        this.$container = $(".source");
        this.$container.prepend(this.view.dom);
        this.$code_mirror = $(this.view.dom);

        this.$container
            .on("mousedown", (e) => {
                if (e.which !== 2 || this._readOnly) return;
                this.view.dispatch({
                    effects: this.editableCmp.reconfigure(EditorView.editable.of(false)),
                });
            })
            .on("mouseup", (e) => {
                if (e.which !== 2) return;
                this._readOnly = true;
                this.view.dispatch({
                    effects: [
                        this.readOnlyCmp.reconfigure(EditorState.readOnly.of(true)),
                        this.editableCmp.reconfigure(EditorView.editable.of(true)),
                    ],
                });
                return this.wdb.paste_target(e);
            });

        this.containerResizeObserver = new ResizeObserver(() => {
            if (this.pendingScrollLno !== null) this.performScroll(this.pendingScrollLno);
        });
        this.containerResizeObserver.observe(this.$container.get(0) as HTMLElement);

        $(window).on("resize", this.size.bind(this));
        this.state = { fn: null, file: null, fun: null, lno: 0 };
        this.fun_scope = null;
        this.footsteps = {};
        this.breakpoints = {};
    }

    external(full: any) {
        if (full == null) full = true;
        const head = this.view.state.selection.main.head;
        const lineObj = this.view.state.doc.lineAt(head);
        let fn = `${this.state.fn}`;
        if (full) {
            fn = `${fn}:${lineObj.number}:${head - lineObj.from + 1}`;
        }
        return this.wdb.ws.send("External", fn);
    }

    save() {
        if (this._readOnly) return;
        const new_file = this.view.state.doc.toString();
        this.wdb.ws.send("Save", `${this.state.fn}|${new_file}`);
        return (this.state.file = new_file);
    }

    clear_breakpoint(brk: any) {
        if (this.breakpoints[brk.fn] == null) this.breakpoints[brk.fn] = [];
        if (Array.from(this.breakpoints[brk.fn]).includes(brk)) {
            this.breakpoints[brk.fn].splice(this.breakpoints[brk.fn].indexOf(brk));
        }
        if (brk.lno) {
            this.remove_mark(brk.lno);
            this.remove_class(brk.lno, "ask-breakpoint");
            return this.remove_class(brk.lno, "breakpoint");
        }
    }

    ask_breakpoint(lno: any) {
        return this.add_class(lno, "ask-breakpoint");
    }

    set_breakpoint(brk: any) {
        if (this.breakpoints[brk.fn] == null) this.breakpoints[brk.fn] = [];
        this.breakpoints[brk.fn].push(brk);
        return this.mark_breakpoint(brk);
    }

    mark_breakpoint(brk: any) {
        if (brk.lno) {
            this.remove_class(brk.lno, "ask-breakpoint");
            this.add_class(brk.lno, "breakpoint");
            return this.add_mark(brk.lno, "breakpoint", brk.temporary ? "○" : "●", this.brk_to_str(brk));
        }
    }

    brk_to_str(brk: any) {
        let str = brk.temporary ? "Temporary " : "";
        str += "Breakpoint";
        if (brk.fun) str += ` On ${brk.fun}`;
        if (brk.lno) str += ` At ${brk.lno}`;
        if (brk.cond) str += ` If ${brk.cond}`;
        return str;
    }

    get_selection() {
        const sel = this.view.state.selection.main;
        return this.view.state.sliceDoc(sel.from, sel.to).trim();
    }

    get_breakpoint(n: any) {
        if (this.breakpoints[this.state.fn] == null) this.breakpoints[this.state.fn] = [];
        for (let brk of Array.from(this.breakpoints[this.state.fn]) as any) {
            if (brk.lno === n) return brk;
        }
    }

    add_class(lno: any, cls: any) {
        this.view.dispatch({ effects: addLineClassEff.of({ lno, cls }) });
    }

    remove_class(lno: any, cls: any) {
        this.view.dispatch({ effects: removeLineClassEff.of({ lno, cls }) });
    }

    add_mark(lno: any, cls: any, char: any, title?: any) {
        this.view.dispatch({
            effects: setBreakMarkerEff.of({
                lno,
                marker: new BreakpointMarker(char, cls, title || ""),
            }),
        });
    }

    remove_mark(lno: any) {
        this.view.dispatch({ effects: setBreakMarkerEff.of({ lno, marker: null }) });
    }

    stop_edition() {
        if (!this._readOnly) return this.toggle_edition();
    }

    toggle_edition() {
        const was_ro = this._readOnly;
        this._readOnly = !was_ro;
        this.view.dispatch({
            effects: [
                this.readOnlyCmp.reconfigure(EditorState.readOnly.of(!was_ro)),
                this.editableCmp.reconfigure(EditorView.editable.of(was_ro)),
            ],
        });
        this.$code_mirror.toggleClass("rw");
        document.querySelector(".el")?.classList.toggle("class");
        this.wdb.print({ for: "Toggling edition", result: `Edit mode ${was_ro ? "on" : "off"}` });
        if (!was_ro) {
            this.view.dispatch({
                changes: { from: 0, to: this.view.state.doc.length, insert: this.state.file },
            });
        }
    }

    open(data: any, frame: any) {
        return this.set_state({
            fn: data.name,
            file: data.file || frame.code,
            fun: frame.function,
            lno: frame.lno,
            flno: frame.flno,
            llno: frame.llno,
        });
    }

    set_state(new_state: any) {
        let lno;
        let rescope = true;

        if (this.state.fn !== new_state.fn || this.state.file !== new_state.file) {
            this.view.dispatch({
                effects: this.langCmp.reconfigure(langExtension(new_state.fn)),
                changes: { from: 0, to: this.view.state.doc.length, insert: new_state.file },
            });
            for (let brk of Array.from(this.breakpoints[new_state.fn] || [])) {
                this.mark_breakpoint(brk);
            }
        } else {
            if (this.state.fun !== new_state.fun) {
                if (this.state.fun !== "<module>") {
                    this.remove_class(this.state.flno, "ctx-top");
                    for (
                        lno = this.state.flno;
                        this.state.flno <= this.state.llno ? lno <= this.state.llno : lno >= this.state.llno;
                        this.state.flno <= this.state.llno ? lno++ : lno--
                    ) {
                        this.remove_class(lno, "ctx");
                    }
                    this.remove_class(this.state.llno, "ctx-bottom");
                }
            } else {
                rescope = false;
            }
        }

        this.state = new_state;

        this.view.dispatch({ effects: setArrowMarkerEff.of(null) });
        for (let step of Array.from(this.footsteps[this.state.fn] || [])) {
            this.remove_class(step, "highlighted");
            this.add_class(step, "footstep");
        }

        if (rescope && this.state.fun !== "<module>") {
            this.add_class(this.state.flno, "ctx-top");
            for (
                lno = this.state.flno;
                this.state.flno <= this.state.llno ? lno <= this.state.llno : lno >= this.state.llno;
                this.state.flno <= this.state.llno ? lno++ : lno--
            ) {
                this.add_class(lno, "ctx");
            }
            this.add_class(this.state.llno, "ctx-bottom");
        }

        this.add_class(this.state.lno, "highlighted");
        this.view.dispatch({ effects: setArrowMarkerEff.of(this.state.lno) });

        if (this.footsteps[this.state.fn] == null) this.footsteps[this.state.fn] = [];
        this.footsteps[this.state.fn].push(this.state.lno);

        const targetLno = this.state.lno;
        if (targetLno >= 1 && targetLno <= this.view.state.doc.lines) {
            this.pendingScrollLno = targetLno;
            // Try immediately (covers the common case: panel already visible,
            // e.g. stepping through code). Also retry after the browser has
            // committed a layout pass (covers the case where `open_code()`
            // just removed `.hidden` in this same tick, so CM6 hasn't
            // measured the newly-visible viewport yet — a single rAF isn't
            // always enough, hence double). `containerResizeObserver` is
            // the final safety net for whatever's left.
            this.performScroll(targetLno);
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    if (this.pendingScrollLno === targetLno) this.performScroll(targetLno);
                });
            });
        } else {
            this.pendingScrollLno = null;
            this.view.requestMeasure();
        }
    }

    private performScroll(targetLno: number) {
        this.view.requestMeasure();
        if (targetLno < 1 || targetLno > this.view.state.doc.lines) return;
        const offset = (this.view.state.doc.line(targetLno) as any).from as number;
        this.view.dispatch({ effects: EditorView.scrollIntoView(offset, { y: "center" }) });

        // Belt-and-suspenders: CM6's declarative scroll effect can silently
        // no-op if the scroller geometry wasn't measured yet at dispatch
        // time. Once real geometry is available, set scrollTop directly.
        const scroller = this.view.scrollDOM;
        if (scroller && scroller.clientHeight > 0) {
            const block = this.view.lineBlockAt(offset);
            const target = block.top - scroller.clientHeight / 2 + block.height / 2;
            scroller.scrollTop = Math.max(0, target);
        }
    }

    focused() {
        return this.view.hasFocus;
    }

    size() {
        this.view.requestMeasure();
    }
}

export { Source };
