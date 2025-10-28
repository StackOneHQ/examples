import { StackOne } from '@stackone/stackone-client-ts';

const client = new StackOne({
  security: {
    username: process.env.STACKONE_API_KEY || '',
    password: ''
  }
});

export default client;
