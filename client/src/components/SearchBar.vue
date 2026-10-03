<template>
  <div class="search-box">
    <button class="btn-search"><i class="fas fa-search"></i></button>
    <input
      v-model="searchText"
      @input="handleInput"
      type="text"
      class="input-search"
      placeholder="Search A ChatRoom..."
    />
  </div>
</template>

<script>
export default {
  props: {
    value: {
      type: String,
      required: true, // Ensure the switch gets a value
    },
  },
  data() {
    return {
      searchText: this.value,
      debounceTimeout: 300,
    };
  },
  methods: {
    handleInput() {
      if (this.debounceTimeout) clearTimeout(this.debounceTimeout);
      this.debounceTimeout = setTimeout(() => {
        this.$emit("onSearch", this.searchText);
      }, this.debounceTime);
    },
  },
  watch: {
    value(newVal) {
      this.searchText = newVal; // Sync external value
    },
  },
};
</script>

<style scoped>
* {
  box-sizing: border-box;
}
body {
  margin: 0px;
  padding: 0px;
  width: 100vw;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #130f40;
}
.search-box {
  width: fit-content;
  height: fit-content;
  position: relative;
  margin-bottom: 5%;
  margin-left: 10px;
}
.input-search {
  height: 50px;
  width: 50px;
  border-style: none;
  padding: 10px;
  font-size: 18px;
  letter-spacing: 2px;
  outline: none;
  border-radius: 25px;
  transition: all 0.5s ease-in-out;
  background-color: #a0dfa8;
  padding-right: 40px;
  color: #000000;
}
.input-search::placeholder {
  color: rgba(0, 0, 0, 0.5);
  font-size: 18px;
  font-weight: 400%;
  letter-spacing: 2px;
}
.btn-search {
  width: 50px;
  height: 50px;
  border-style: none;
  font-size: 20px;
  font-weight: bold;
  outline: none;
  cursor: pointer;
  border-radius: 50%;
  position: absolute;
  right: 0px;
  color: #000000;
  background-color: transparent;
  pointer-events: painted;
}
.btn-search:focus ~ .input-search {
  width: 300px;
  border-radius: 0px;
  background-color: transparent;
  border-bottom: 1px solid rgba(128, 128, 128, 0.5);
  transition: all 500ms cubic-bezier(0, 0.11, 0.35, 2);
}
.input-search:focus {
  width: 300px;
  border-radius: 0px;
  background-color: transparent;
  border-bottom: 1px solid rgba(255, 255, 255, 0.5);
  transition: all 500ms cubic-bezier(0, 0.11, 0.35, 2);
}
</style>
