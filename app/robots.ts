import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://krushios.vercel.app';

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/features',
          '/pricing',
          '/about',
          '/contact',
          '/support',
          '/privacy',
          '/terms',
          '/refund-policy',
          '/billing-policy',
          '/cookie-policy',
          '/data-processing',
          '/acceptable-use',
          '/grievance',
          '/data-request',
          '/login',
          '/customer/login',
        ],
        disallow: [
          '/dashboard',
          '/dashboard/*',
          '/billing',
          '/billing/*',
          '/sales',
          '/sales/*',
          '/products',
          '/products/*',
          '/inventory',
          '/inventory/*',
          '/purchases',
          '/purchases/*',
          '/customers',
          '/customers/*',
          '/suppliers',
          '/suppliers/*',
          '/credit',
          '/credit/*',
          '/reports',
          '/reports/*',
          '/settings',
          '/settings/*',
          '/employees',
          '/employees/*',
          '/customer/dashboard',
          '/customer/dashboard/*',
          '/docs/v/*',
          '/api/*',
          '/auth/*',
        ],
      },
    ],
    sitemap: `${baseUrl.replace(/\/+$/, '')}/sitemap.xml`,
  };
}
