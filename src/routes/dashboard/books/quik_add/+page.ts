import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  // You can add server-side logic here if needed
  return {
    title: 'Quick Add Books'
  };
};
