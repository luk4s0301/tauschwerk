// Applied before the stylesheet loads, including on Home Assistant ingress paths.
(() => {
  const key='swivo-theme', valid=value=>value==='light'||value==='dark';
  const system=window.matchMedia('(prefers-color-scheme: dark)');
  let preference;
  try {preference=localStorage.getItem(key);} catch {}
  const apply=theme=>{
    document.documentElement.dataset.theme=theme;
    document.querySelector('meta[name="color-scheme"]')?.setAttribute('content',theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#14131e':'#f5f3f8');
    window.dispatchEvent(new CustomEvent('swivo-theme-change'));
  };
  window.SwivoTheme={
    toggle(){preference=document.documentElement.dataset.theme==='dark'?'light':'dark';apply(preference);try{localStorage.setItem(key,preference);}catch{}},
  };
  system.addEventListener('change',()=>{if(!valid(preference))apply(system.matches?'dark':'light');});
  window.addEventListener('storage',event=>{if(event.key===key||event.key===null){preference=event.newValue;apply(valid(preference)?preference:system.matches?'dark':'light');}});
  apply(valid(preference)?preference:system.matches?'dark':'light');
})();
