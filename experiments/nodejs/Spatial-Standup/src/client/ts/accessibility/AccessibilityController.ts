

export class AccessibilityController {
    constructor() {}

    speak(text: string, priority?: string, delayMS?: number) {
        let el = document.createElement("div");
        let id = "speak-" + Date.now();
        el.setAttribute("id", id);
        el.setAttribute("aria-live", priority || "polite");
        el.classList.add("sr-only");
        document.body.appendChild(el);
  
        // 100ms timeout so `aria-live` knows that the contents of the div
        // changed and thus must be read.
        // Lower timeouts work inconsistently.
        setTimeout(() => {
          document.getElementById(id).innerHTML = text;
        }, delayMS || 100);
  
        setTimeout(() => {
            document.body.removeChild(document.getElementById(id));
        }, 1000);
    }
}
