import { Log } from "./_base";
import { Dbgr } from "./dbgr";
import "./scss/_interpreter.scss";

class Interpreter extends Log {
    public dbgr: Dbgr;
    public $terminal: JQuery;
    public $scrollback: JQuery;

    constructor(dbgr: Dbgr) {
        super();
        this.dbgr = dbgr;
        this.$terminal = $(".terminal")
            .on("click", () => {
                if (!getSelection().toString()) {
                    return this.focus();
                }
            })
            .on("click", "a.inspect", this.inspect.bind(this));
        this.$scrollback = $(".scrollback")
            .on("click", ".short.close", this.short_open.bind(this))
            .on("click", ".short.open", this.short_close.bind(this))
            .on("click", ".toggle", this.toggle_visibility.bind(this));
    }

    scroll(direction: number = null) {
        if (direction) {
            this.$terminal.scrollTop(
                this.$terminal.scrollTop() + direction * this.$terminal.height()
            );
            return;
        }

        return this.dbgr.prompt.$container.get(0).scrollIntoView({
            behavior: "smooth",
        });
    }

    clear() {
        return this.$scrollback.empty();
    }

    write(elt: HTMLElement) {
        return this.$scrollback.append(elt);
    }

    inspect(e: JQuery.ClickEvent) {
        return this.dbgr.inspect($(e.currentTarget).attr("href"));
    }

    short_open(e: JQuery.ClickEvent) {
        return $(e.currentTarget)
            .addClass("open")
            .removeClass("close")
            .next(".long")
            .show("fast");
    }

    short_close(e: JQuery.ClickEvent) {
        return $(e.currentTarget)
            .addClass("close")
            .removeClass("open")
            .next(".long")
            .hide("fast");
    }

    toggle_visibility(e: JQuery.ClickEvent) {
        return $(e.currentTarget)
            .add($(e.currentTarget).next())
            .toggleClass("closed");
    }

    focus(e?: JQuery.EventBase) {
        const scroll = this.$terminal.scrollTop();
        this.dbgr.prompt.focus();
        return this.$terminal.scrollTop(scroll);
    }
}

export { Interpreter };
