# 06 — Integración con AEM

## Objetivo
Embeber el iframe en las páginas de AEM con el tamaño correcto, los params de site/landing y las políticas de seguridad que AEM requiere.

**Tiempo estimado:** 1 hora
**Dependencias:** `05-iframe-embed.md` desplegado en `ugc.hikvisionlatam.tech`
**Siguiente módulo:** `07-roles-auth.md`

---

## 1. Tag base

```html
<iframe
  src="https://ugc.hikvisionlatam.tech/embed?site=co&landing=colorvu"
  width="100%"
  height="520"
  frameborder="0"
  scrolling="no"
  title="Videos ColorVu en TikTok — Hikvision Colombia"
  loading="lazy"
  allow="autoplay"
  style="border: none; display: block;"
></iframe>
```

---

## 2. Por país y landing

```html
<!-- Colombia — ColorVu -->
<iframe src="https://ugc.hikvisionlatam.tech/embed?site=co&landing=colorvu"
  width="100%" height="520" frameborder="0" scrolling="no"
  title="ColorVu en TikTok — Hikvision Colombia"
  loading="lazy" allow="autoplay"></iframe>

<!-- Colombia — AcuSense -->
<iframe src="https://ugc.hikvisionlatam.tech/embed?site=co&landing=acusense"
  width="100%" height="520" frameborder="0" scrolling="no"
  title="AcuSense en TikTok — Hikvision Colombia"
  loading="lazy" allow="autoplay"></iframe>

<!-- México — ColorVu -->
<iframe src="https://ugc.hikvisionlatam.tech/embed?site=mx&landing=colorvu"
  width="100%" height="520" frameborder="0" scrolling="no"
  title="ColorVu en TikTok — Hikvision México"
  loading="lazy" allow="autoplay"></iframe>

<!-- Brasil — ColorVu -->
<iframe src="https://ugc.hikvisionlatam.tech/embed?site=br&landing=colorvu"
  width="100%" height="520" frameborder="0" scrolling="no"
  title="ColorVu no TikTok — Hikvision Brasil"
  loading="lazy" allow="autoplay"></iframe>

<!-- LATAM general -->
<iframe src="https://ugc.hikvisionlatam.tech/embed?site=latam&landing=colorvu"
  width="100%" height="520" frameborder="0" scrolling="no"
  title="ColorVu en TikTok — Hikvision LATAM"
  loading="lazy" allow="autoplay"></iframe>
```

---

## 3. Altura responsiva — wrapper con aspect-ratio

Si AEM no controla la altura de forma dinámica, usar este wrapper:

```html
<div style="position: relative; width: 100%; padding-bottom: 38%; min-height: 300px; max-height: 560px;">
  <iframe
    src="https://ugc.hikvisionlatam.tech/embed?site=co&landing=colorvu"
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;"
    title="ColorVu en TikTok — Hikvision Colombia"
    loading="lazy"
    allow="autoplay"
  ></iframe>
</div>
```

**Alturas recomendadas por breakpoint:**

| Viewport | Alto sugerido |
|---------|--------------|
| Desktop (≥ 1024px) | 520px |
| Tablet (768–1023px) | 440px |
| Mobile (< 768px) | 360px |

---

## 4. Políticas de seguridad en AEM

AEM puede bloquear iframes externos. Confirmar con el equipo técnico que estas directivas están en la CSP del dispatcher:

```
frame-src: https://ugc.hikvisionlatam.tech;
img-src:   https://kocassets.hikvisionlatam.tech;
media-src: https://kocassets.hikvisionlatam.tech;
```

En el servidor del iframe (`ugc.hikvisionlatam.tech`), la respuesta debe incluir:

```
Content-Security-Policy: frame-ancestors https://hikvision.com https://*.hikvision.com https://hikvisionlatam.tech
```

Configurar en Nginx (o en `vercel.json` si aplica):

```nginx
# En el bloque del site ugc-iframe
add_header Content-Security-Policy "frame-ancestors https://hikvision.com https://*.hikvision.com" always;
```

---

## 5. Ocultar el iframe si no hay videos

El iframe manda `postMessage` cuando no tiene contenido. Agregar este script en la página AEM junto al iframe:

```html
<script>
  window.addEventListener('message', function(event) {
    if (event.origin !== 'https://ugc.hikvisionlatam.tech') return;
    if (event.data?.type === 'UGC_EMPTY') {
      var wrapper = document.querySelector('[data-ugc-wrapper]');
      if (wrapper) wrapper.style.display = 'none';
    }
  });
</script>

<!-- Envolver el iframe con el atributo -->
<div data-ugc-wrapper>
  <iframe src="https://ugc.hikvisionlatam.tech/embed?site=co&landing=colorvu"
    ...></iframe>
</div>
```

---

## 6. Componente AEM reutilizable (si el equipo dev puede crearlo)

```html
<!-- HTL / Sightly -->
<div class="ugc-embed" data-ugc-wrapper
  style="width: 100%;">
  <iframe
    src="https://ugc.hikvisionlatam.tech/embed?site=${properties.ugcSite @ context='uri'}&landing=${properties.ugcLanding @ context='uri'}"
    width="100%"
    height="${properties.ugcHeight @ defaultValue='520'}"
    frameborder="0"
    scrolling="no"
    title="${properties.ugcTitle @ i18n}"
    loading="lazy"
    allow="autoplay"
    style="border: none; display: block;"
  ></iframe>
</div>
```

**Propiedades editables en el dialog de AEM:**

| Propiedad | Tipo | Default |
|-----------|------|---------|
| `ugcSite` | Select: co / mx / br / latam | `latam` |
| `ugcLanding` | Text | `colorvu` |
| `ugcHeight` | Number (px) | `520` |
| `ugcTitle` | Text | Videos en TikTok |

---

## 7. Checklist de prueba por página

```
Para cada página AEM con iframe UGC:

□ El iframe carga sin errores en consola del navegador
□ Los videos aparecen con thumbnail correcto
□ El idioma es correcto (español / portugués para Brasil)
□ Play/pause funciona al hacer clic en el video
□ Mute/unmute funciona
□ Las miniaturas cambian el video principal
□ El botón "Ver en TikTok" abre en nueva pestaña
□ El botón "Ver producto" (si está configurado) lleva a la URL correcta
□ En mobile el slider se adapta (1 columna de thumbs o solo video)
□ Si no hay videos, el wrapper desaparece sin dejar espacio en blanco
□ Assets cargan desde kocassets.hikvisionlatam.tech (verificar en Network tab)
```

---

## Checklist de este módulo

- [ ] Iframe embebido en al menos una página de prueba por país
- [ ] Height definido correctamente para desktop y mobile
- [ ] `allow="autoplay"` presente
- [ ] `title` descriptivo en cada iframe
- [ ] CSP de AEM permite `frame-src: ugc.hikvisionlatam.tech`
- [ ] CSP del iframe permite `frame-ancestors` para dominios Hikvision
- [ ] `postMessage` oculta el wrapper si no hay videos
- [ ] Probado en Chrome, Safari y Firefox
- [ ] Probado en iOS Safari y Android Chrome

**Siguiente → `07-roles-auth.md`**
