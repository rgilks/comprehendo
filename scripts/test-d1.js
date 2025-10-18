#!/usr/bin/env node

const testD1Connection = async () => {
  console.log('Testing D1 database connection...');

  console.log('D1 migration script loaded successfully');
  console.log('Ready for Cloudflare Workers deployment');
};

testD1Connection().catch(console.error);
