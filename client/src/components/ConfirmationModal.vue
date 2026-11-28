<template>
  <div class="modal-overlay">
    <div class="modal-content">
      <h3>{{ title }}</h3>
      <p>{{ description }}</p>
      <div class="modal-actions">
        <button @click="onConfirm" class="confirm-btn">{{ confirmText }}</button>
        <button @click="onCancel" class="cancel-btn">{{ cancelText }}</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    title: {
      type: String,
      default: "Confirm Action",
    },
    description: {
      type: String,
      default: "Are you sure you want to proceed?",
    },
    confirmText: {
      type: String,
      default: "Yes",
    },
    cancelText: {
      type: String,
      default: "No",
    },
    onConfirm: {
      type: Function,
      required: true,
    },
    onCancel: {
      type: Function,
      required: true,
    },
  },
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: var(--overlay);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: var(--surface);
  padding: 20px;
  border-radius: 8px;
  width: 300px;
  text-align: center;
  box-shadow: 0 4px 8px rgba(43, 29, 20, 0.2);
}

.modal-actions {
  display: flex;
  justify-content: space-around;
  margin-top: 20px;
}

.confirm-btn {
  background: var(--danger);
  color: var(--on-brand);
  border: none;
  padding: 10px 15px;
  border-radius: 4px;
  cursor: pointer;
}

.confirm-btn:hover {
  background: var(--danger-hover);
}

.cancel-btn {
  background: var(--cocoa);
  color: var(--on-brand);
  border: none;
  padding: 10px 15px;
  border-radius: 4px;
  cursor: pointer;
}

.cancel-btn:hover {
  background: var(--ink);
}
</style>