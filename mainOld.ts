import { serve } from "https://deno.land/std@0.140.0/http/server.ts";

const getContentType = (name: string) => {
  if (name.endsWith('.js')) {
    return 'text/javascript';
  }
  if (name.endsWith('.css')) {
    return 'text/css';
  }
  if (name.endsWith('.html')) {
    return 'text/html; charset=utf-8';
  }
  return 'charset=utf-8';
}

const fileNameMap = {
  '/': 'index.html',
}

async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  url.host = 'www.okx.com';
  const fileName = fileNameMap[url.pathname];

  if (fileName) {
    const file = await Deno.readFile(`./${fileName}`);
    return new Response(file, {
      headers: {
        "content-type": getContentType(fileName),
        // "Link": `<https://cdn.myshopline.com>; rel="preconnect", <https://cdn-theme.myshopline.com>; rel="preconnect", <https://img.myshopline.com>; rel="preconnect", <https://img-va.myshopline.com>; rel="preconnect", <https://cdn-theme.myshopline.com/cdn/shop/prod//1739533831686/67d2968cf3641f2d25531bfd/1746799962559/assets/component-tool-tip.css>; rel="preload"; as="style", <https://cdn-theme.myshopline.com/cdn/shop/prod//1739533831686/67d2968cf3641f2d25531bfd/1746799969968/assets/component-product-modal.css>; rel="preload"; as="style", <https://cdn-theme.myshopline.com/cdn/shop/prod//1739533831686/67d2968cf3641f2d25531bfd/1746799969032/assets/section-collapsible-content.css>; rel="preload"; as="style", <https://cdn-theme.myshopline.com/cdn/shop/prod//1739533831686/67d2968cf3641f2d25531bfd/1746799962602/assets/section-main-product.css>; rel="preload"; as="style", <https://cdn-theme.myshopline.com/cdn/shop/prod//1739533831686/67d2968cf3641f2d25531bfd/1746799970625/assets/component-accordion.css>; rel="preload"; as="style", <https://cdn-theme.myshopline.com/cdn/shop/prod//1739533831686/67d2968cf3641f2d25531bfd/1746799962605/assets/section-main-product-media-gallery.css>; rel="preload"; as="style"`
        "Link": `
          <https://img.bgstatic.com>; rel="preconnect",
          </portalx-static/client/css/6f3609aa633de3d72c56.css>; as="style"; rel="preload", 
          </portalx-static/client/css/f200c74013e4ba0700bf.css>; as="style"; rel="preload",
          </portalx-static/client/css/a6c0f1b486b804cd1da2.css>; as="style"; rel="preload",
          </baseasset/fonts/Switzer-Regular.otf>; as="font"; rel="preload"; crossorigin="anonymous",
          </baseasset/fonts/Switzer-Medium.otf>; as="font"; rel="preload"; crossorigin="anonymous",
          </baseasset/fonts/Switzer-Bold.otf>; as="font"; rel="preload"; crossorigin="anonymous",
          </baseasset/fonts/Switzer-Semibold.otf>; as="font"; rel="preload"; crossorigin="anonymous",
        `.split(',').map(str => str.trim()).join(', ')
      },
    });
  }

  const res = await fetch(url.toString(), {
    headers: request.headers,
    method: request.method,
    body: request.body,
  });

  const headers = new Headers(res.headers);
  headers.set('cache-control', 'public, max-age=31556952, immutable');
  
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

serve(handleRequest, { port: 80 });