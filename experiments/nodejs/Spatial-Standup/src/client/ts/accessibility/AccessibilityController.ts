

export class AccessibilityController {
    constructor() {}

    speak(text: string, priority?: string) {
        console.log("speaking text")
        let el = document.createElement("div");
        let id = "speak-" + Date.now();
        el.setAttribute("id", id);
        el.setAttribute("aria-live", priority || "polite");
        el.classList.add("sr-only");
        document.body.appendChild(el);
  
        setTimeout(() => {
          document.getElementById(id).innerHTML = text;
        }, 100);
  
        setTimeout(() => {
            document.body.removeChild(document.getElementById(id));
        }, 1000);
    }
}
