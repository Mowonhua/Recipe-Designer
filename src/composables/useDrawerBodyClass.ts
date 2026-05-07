import { watch, type Ref } from 'vue';

const openWidths: number[] = [];

function updateDrawerWidth() {
  if (openWidths.length === 0) {
    document.body.style.removeProperty('--drawer-width');
    document.body.classList.remove('drawer-open');
  } else {
    const maxWidth = Math.max(...openWidths);
    document.body.style.setProperty('--drawer-width', `${maxWidth}px`);
    document.body.classList.add('drawer-open');
  }
}

export function useDrawerBodyClass(visible: Ref<boolean>, width: number = 420) {
  watch(visible, (val) => {
    if (val) {
      openWidths.push(width);
    } else {
      const idx = openWidths.indexOf(width);
      if (idx >= 0) openWidths.splice(idx, 1);
    }
    updateDrawerWidth();
  });
}
