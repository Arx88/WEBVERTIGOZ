import re
import sys

with open("/home/z/my-project/research/vertigo-original/src/app/globals.css", "r") as f:
    css = f.read()

# Quitar los imports de tailwind que ya están en globals.css principal
css = css.replace('@import "tailwindcss";', '')
css = css.replace('@import "tw-animate-css";', '')
css = css.replace('@custom-variant dark (&:is(.dark *));', '')

# Quitar el bloque @theme inline que ya está en tailwind.config
css = re.sub(r'@theme inline \{[^}]+\}', '', css)

# Quitar las variables CSS globales (:root --radius, --background, etc.)
css = re.sub(r':root \{[^}]+\}', '', css)

# Quitar reset global del * (ya está en globals.css)
css = re.sub(r'\* \{[^}]+\}', '', css)

# Quitar html, body globales (ya están en globals.css)
css = re.sub(r'html \{[^}]+\}', '', css)
css = re.sub(r'html, body \{[^}]+\}', '', css)
css = re.sub(r'body::after \{[^}]+\}', '', css)

# Reemplazar body.v-on → .ruleta-wrapper.v-on
css = css.replace('body.v-on', '.ruleta-wrapper.v-on')
css = css.replace('body.epic-cards', '.ruleta-wrapper.epic-cards')
css = css.replace('body::after', '.ruleta-wrapper::after')

# Asegurar que .ruleta-wrapper sea position:relative + overflow:hidden para contener todo
header = """
/* ============================================================
   VÉRTIGO Ruleta — CSS scoped al wrapper .ruleta-wrapper
   NO afecta al resto del sitio.
   ============================================================ */

.ruleta-wrapper {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: #050505;
  color: #fff;
  font-family: var(--font-oswald), sans-serif;
  user-select: none;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  overflow: hidden;
}

.ruleta-wrapper::after {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  box-shadow: inset 0 0 20vmax rgba(5, 5, 5, 0.4);
  z-index: 500;
}

/* Color-scheme hereda del html oscuro */
.ruleta-wrapper {
  color-scheme: dark;
}

"""

# Output final
result = header + "\n" + css

with open("/home/z/my-project/webvertigo/src/styles/ruleta.css", "w") as f:
    f.write(result)

print(f"OK - wrote {len(result)} chars to ruleta.css")
