import { Log } from "./_base";
import { Prompt } from "./_prompt";

class History extends Log {
    public prompt: Prompt;
    public index: number;
    public current: string;
    public currentPos: number;
    public oldIndex: number;
    public originalIndex: number;
    public overlay: RegExp | null;
    public history: string[];
    public sessionIndexStart: number;
    public lastResult: number;

    constructor(prompt: Prompt) {
        super();
        this.prompt = prompt;
        this.index = -1;
        this.current = "";
        this.currentPos = 0;

        this.oldIndex = null;
        this.originalIndex = null;
        this.overlay = null;

        try {
            this.history = JSON.parse(localStorage["history"] || "[]");
        } catch (error) {
            const e = error;
            this.fail(e);
            this.history = [];
        }

        this.sessionIndexStart = this.history.filter(
            (e: string) => e.indexOf(".") !== 0
        ).length;
    }

    up(): number {
        if (this.index === -1) {
            this.saveCurrent();
        }

        this.index = Math.min(this.history.length - 1, this.index + 1);
        return this.sync();
    }

    down(): number {
        this.index = Math.max(this.index - 1, -1);
        return this.sync();
    }

    saveCurrent(): void {
        this.current = this.prompt.get();
        this.currentPos = this.prompt.view.state.selection.main.head;
    }

    sync(): number {
        if (this.index === -1) {
            this.prompt.set(this.current);
            this.prompt.view.dispatch({
                selection: { anchor: this.currentPos },
            });
        } else {
            this.prompt.set(this.history[this.index]);
            const docLen = this.prompt.view.state.doc.length;
            this.prompt.view.dispatch({
                selection: { anchor: docLen },
            });
        }
        return this.index;
    }

    historize(snippet: string): string {
        let index;
        if (!snippet) {
            return;
        }
        while ((index = this.history.indexOf(snippet)) !== -1) {
            this.history.splice(index, 1);
        }
        this.history.unshift(snippet);
        return (
            localStorage &&
            (localStorage["history"] = JSON.stringify(this.history))
        );
    }

    reset(): void {
        this.index = -1;
        this.current = "";
        this.currentPos = 0;
    }

    clear(): void {
        this.history = [];
        this.sessionIndexStart = 0;
        this.reset();
    }

    searchPrev(val: string): boolean {
        return this.searchNext(val, -1);
    }

    searchNext(val: string, step: number): boolean {
        if (step == null) {
            step = 1;
        }
        if (this.oldIndex == null) {
            this.oldIndex = this.index;
        }
        if (this.originalIndex == null) {
            this.originalIndex = this.index;
            if (this.index === -1) {
                this.saveCurrent();
            }
        }

        while (
            (step === 1 && this.index < this.history.length) ||
            (step === -1 && this.index > -1)
        ) {
            this.index += step;
            const re = new RegExp(
                `(${val.replace(
                    /[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g,
                    "\\$&"
                )})`,
                "gi"
            );
            if (re.test(this.history[this.index])) {
                this.lastResult = this.index;
                this.sync();
                this.overlay != null && this.prompt.removeSearchHighlight();
                this.overlay = re;
                this.prompt.addSearchHighlight(re);
                return true;
            }
        }
        return false;
    }

    commitSearch(): number {
        this.oldIndex = null;
        this.originalIndex = null;
        this.index = this.lastResult;
        return this.sync();
    }

    rollbackSearch(): number {
        this.oldIndex = null;
        if (this.originalIndex != null) {
            this.index = this.originalIndex;
        }
        this.originalIndex = null;
        if (this.overlay != null) {
            this.prompt.removeSearchHighlight();
        }
        this.overlay = null;
        return this.sync();
    }

    resetSearch(): number {
        if (this.oldIndex != null) {
            this.index = this.oldIndex;
        }
        return (this.oldIndex = null);
    }

    getSessionHistory(): string[] {
        return this.history.slice(
            0,
            this.history.length - this.sessionIndexStart
        );
    }

    getHistory(direction: string) {
        let begin = 0;
        let end = this.history.length - this.sessionIndexStart;
        if (direction === "down") {
            end = this.index + 1;
        } else if (direction === "up") {
            begin = this.index;
        }
        return this.history.slice(begin, end);
    }
}

export { History };
