import { Log } from "./_base";
import { Wdb } from "./wdb";
import "./scss/_variables.scss";

interface VarEntry {
    val: string;
    type: string;
    expandable: boolean;
    len: number | null;
    watch?: boolean;
    path?: string;
}

interface VarNode extends VarEntry {
    name: string;
    path: string;
    expanded: boolean;
    loading: boolean;
    children: Record<string, VarNode> | null;
}

// PyCharm/pudb-style variables tree: locals+globals auto-shown, explicit
// watch expressions in a separate section, lazy expand for containers and
// objects, inline edit on double-click.
class Variables extends Log {
    public wdb: Wdb;
    public $panel: JQuery;
    public $body: JQuery;
    private nodes: Record<string, VarNode>;

    constructor(wdb: Wdb) {
        super();
        this.wdb = wdb;
        this.nodes = {};
        this.$panel = $(".variables-panel");
        this.$body = this.$panel.find(".variables-body");
        this.$panel
            .on("click", ".var-toggle.clickable", (e) => this.onToggle(e))
            .on("click", ".var-unwatch", (e) => this.onUnwatch(e))
            .on("dblclick", ".var-value", (e) => this.onEditStart(e));
    }

    sortNames(names: string[]): string[] {
        return names.sort((a, b) => a.localeCompare(b));
    }

    findNode(path: string): VarNode | null {
        const search = (
            nodes: Record<string, VarNode> | null
        ): VarNode | null => {
            if (!nodes) return null;
            for (const key of Object.keys(nodes)) {
                const node = nodes[key];
                if (node.path === path) return node;
                const found = search(node.children);
                if (found) return found;
            }
            return null;
        };
        return search(this.nodes);
    }

    updateAll(data: Record<string, VarEntry>) {
        const newNodes: Record<string, VarNode> = {};
        for (const name of Object.keys(data || {})) {
            const entry = data[name];
            const prev = this.nodes[name];
            newNodes[name] = {
                ...entry,
                name,
                path: entry.path || name,
                expanded: prev ? prev.expanded : false,
                loading: false,
                children: prev ? prev.children : null,
            };
        }
        this.nodes = newNodes;
        this.render();
    }

    receiveExpand(data: {
        path: string;
        children?: Record<string, VarEntry>;
        error?: string;
    }) {
        const target = this.findNode(data.path);
        if (!target) return;
        target.loading = false;
        if (data.error) {
            target.children = {};
            this.fail("Expand", data.path, data.error);
        } else {
            const children: Record<string, VarNode> = {};
            const raw = data.children || {};
            for (const cname of Object.keys(raw)) {
                const centry = raw[cname];
                const prevChild =
                    target.children && target.children[cname];
                children[cname] = {
                    ...centry,
                    name: cname,
                    path: centry.path as string,
                    expanded: prevChild ? prevChild.expanded : false,
                    loading: false,
                    children: prevChild ? prevChild.children : null,
                };
            }
            target.children = children;
        }
        this.render();
        this.wdb.chilling();
    }

    onToggle(e: JQuery.ClickEvent) {
        const $row = $(e.currentTarget).closest(".var-row");
        const path = $row.attr("data-path") as string;
        const node = this.findNode(path);
        if (!node || !node.expandable) return;
        node.expanded = !node.expanded;
        if (node.expanded && !node.children) {
            node.loading = true;
            this.wdb.ws.send("Expand", { path });
            this.wdb.working();
        }
        this.render();
    }

    onUnwatch(e: JQuery.ClickEvent) {
        e.stopPropagation();
        const $row = $(e.currentTarget).closest(".var-row");
        const path = $row.attr("data-path") as string;
        this.wdb.unwatch(path);
        return false;
    }

    onEditStart(e: JQuery.DoubleClickEvent) {
        const $cell = $(e.currentTarget);
        if ($cell.find("input.var-edit-input").length) return;
        const $row = $cell.closest(".var-row");
        const path = $row.attr("data-path") as string;
        const node = this.findNode(path);
        if (!node) return;
        const current = node.expandable
            ? node.val
            : $cell.text();
        const $input = $("<input>", {
            type: "text",
            class: "var-edit-input",
            value: current,
        });
        $cell.empty().append($input);
        $input.trigger("focus");
        (($input.get(0) as HTMLInputElement)).select();

        const commit = () => {
            const value = String($input.val());
            this.wdb.ws.send("SetVar", { expr: path, value });
            this.wdb.working();
        };
        $input.on("keydown", (ev) => {
            if (ev.key === "Enter") {
                ev.preventDefault();
                commit();
            } else if (ev.key === "Escape") {
                ev.preventDefault();
                this.render();
            }
        });
        $input.on("blur", () => this.render());
        return false;
    }

    render() {
        this.$body.empty();
        const names = Object.keys(this.nodes);
        const locals = this.sortNames(
            names.filter((n) => !this.nodes[n].watch)
        );
        const watches = this.sortNames(
            names.filter((n) => this.nodes[n].watch)
        );

        this.$body.append(
            $("<div>", { class: "var-section-title" }).text("Variables:")
        );
        if (locals.length) {
            for (const n of locals) this.renderNode(this.nodes[n], 0);
        } else {
            this.$body.append(
                $("<div>", { class: "var-empty" }).text("No locals")
            );
        }

        this.$body.append(
            $("<div>", { class: "var-section-title" }).text("Watches:")
        );
        this.$body.append(this.buildWatchInput());
        for (const n of watches) this.renderNode(this.nodes[n], 0);
    }

    buildWatchInput(): JQuery {
        const $row = $("<div>", { class: "var-row var-add-watch" });
        const $input = $("<input>", {
            type: "text",
            class: "var-watch-input",
            placeholder: "watch expression\u2026",
        });
        $row.append($input);
        $input.on("keydown", (ev) => {
            if (ev.key !== "Enter") return;
            const expr = String($input.val()).trim();
            if (!expr) return;
            this.wdb.ws.send("Watch", expr);
            this.wdb.working();
            $input.val("");
        });
        return $row;
    }

    renderNode(node: VarNode, depth: number) {
        const $row = $("<div>", { class: "var-row" }).attr(
            "data-path",
            node.path
        );
        $row.css("padding-left", `${depth}rem`);

        const $toggle = $("<span>", { class: "var-toggle" });
        if (node.expandable) {
            $toggle
                .addClass("clickable")
                .text(node.expanded ? "-" : "+");
        } else {
            $toggle.html("&nbsp;");
        }
        $row.append($toggle);

        $row.append($("<span>", { class: "var-name" }).text(node.name));

        const typeText =
            node.len != null ? `${node.type}[${node.len}]` : node.type;
        $row.append($("<span>", { class: "var-type" }).text(typeText));

        const $value = $("<span>", { class: "var-value" });
        if (node.expandable) {
            $value.text(node.val);
        } else {
            this.wdb.code($value, node.val, [], true);
        }
        $row.append($value);

        if (node.watch) {
            $row.append(
                $("<span>", { class: "var-unwatch material-icons" }).text(
                    "close"
                )
            );
        }

        this.$body.append($row);

        if (node.expandable && node.expanded) {
            if (node.loading || !node.children) {
                const $loading = $("<div>", {
                    class: "var-row var-loading",
                }).text("Loading\u2026");
                $loading.css("padding-left", `${depth + 1}rem`);
                this.$body.append($loading);
            } else {
                const childNames = this.sortNames(
                    Object.keys(node.children)
                );
                for (const cname of childNames) {
                    this.renderNode(node.children[cname], depth + 1);
                }
            }
        }
    }
}

export { Variables };
