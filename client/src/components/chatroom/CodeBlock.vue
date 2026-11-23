<template>
  <figure class="code-block">
    <figcaption>
      <span class="language">{{ language || "code" }}</span>
      <button class="copy" :title="copied ? 'Copied' : 'Copy code'" @click="copy">
        <i :class="copied ? 'fa-solid fa-check' : 'fa-regular fa-copy'"></i>
        {{ copied ? "Copied" : "Copy" }}
      </button>
    </figcaption>
    <pre><code>{{ code }}</code></pre>
  </figure>
</template>

<script>
/** A code snippet shown in a dark, monospaced panel with a copy button. */
export default {
  name: "CodeBlock",
  props: {
    code: { type: String, required: true },
    language: { type: String, default: "" },
  },
  data() {
    return { copied: false };
  },
  beforeDestroy() {
    clearTimeout(this.resetTimer);
  },
  methods: {
    async copy() {
      try {
        await navigator.clipboard.writeText(this.code);
        this.copied = true;
        clearTimeout(this.resetTimer);
        this.resetTimer = setTimeout(() => (this.copied = false), 1500);
      } catch {
        this.$toast.error("Couldn't copy the code.");
      }
    },
  },
};
</script>

<style scoped>
.code-block {
  margin: 6px 0;
  border-radius: 8px;
  overflow: hidden;
  background: var(--code-bg);
  color: var(--code-text);
  min-width: min(420px, 100%);
}
figcaption {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 10px;
  font-size: 0.75em;
  background: rgba(255, 255, 255, 0.06);
  color: #a9b1c6;
}
.language {
  text-transform: lowercase;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
}
.copy {
  border: none;
  background: none;
  color: inherit;
  cursor: pointer;
}
.copy:hover {
  color: #fff;
}
pre {
  margin: 0;
  padding: 10px 12px;
  overflow-x: auto;
  font-size: 0.85em;
  line-height: 1.5;
}
code {
  font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
  color: inherit;
  white-space: pre;
}
</style>
