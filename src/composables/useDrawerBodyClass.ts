import { watch, type Ref } from 'vue';

let openCount = 0;

export function useDrawerBodyClass(visible: Ref<boolean>) {
  watch(visible, (val) => {
    if (val) {
      openCount++;
      document.body.classList.add('drawer-open');
    } else {
      openCount = Math.max(0, openCount - 1);
      if (openCount === 0) {
        document.body.classList.remove('drawer-open');
      }
    }
  });
}
