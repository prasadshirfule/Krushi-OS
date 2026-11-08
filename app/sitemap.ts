import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://krushios.vercel.app').replace(/\/+$/, '');
  const now = new Date();

  const publicRoutes = [
    '',
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
  ];

  return publicRoutes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: route === '' ? 'daily' : 'monthly',
    priority: route === '' ? 1.0 : route === '/pricing' || route === '/features' ? 0.8 : 0.5,
  }));
}
