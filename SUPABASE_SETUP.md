# Supabase Setup Instructions

## Introduction
This document provides comprehensive instructions for integrating Supabase PostgreSQL with realtime features in your application.

## Database Schema
1. **Create a new Supabase project**.
2. **Create tables in your database**:
   - Users table
   - Posts table
   - Comments table

   Example schema:
   ```sql
   CREATE TABLE users (
       id serial PRIMARY KEY,
       username VARCHAR(255) NOT NULL,
       email VARCHAR(255) UNIQUE NOT NULL,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   
   CREATE TABLE posts (
       id serial PRIMARY KEY,
       user_id INT REFERENCES users(id),
       content TEXT,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   
   CREATE TABLE comments (
       id serial PRIMARY KEY,
       post_id INT REFERENCES posts(id),
       user_id INT REFERENCES users(id),
       content TEXT,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

## Authentication Setup
1. **Enable authentication providers** in the Supabase dashboard (email/password, social login).
2. **Implement user sign-up and sign-in**:
   - Use Supabase client libraries:
   ```javascript
   import { createClient } from '@supabase/supabase-js';
   
   const supabaseUrl = 'https://your-project.supabase.co';
   const supabaseAnonKey = 'your-anon-key';
   const supabase = createClient(supabaseUrl, supabaseAnonKey);
   
   // Sign up a new user
   const { user, error } = await supabase.auth.signUp({
       email: 'example@example.com',
       password: 'password'
   });
   ```

## Code Implementation Examples
1. **Fetching data**:
   ```javascript
   const { data, error } = await supabase
       .from('posts')
       .select('*');
   ```

2. **Realtime features**:
   ```javascript
   const subscription = supabase
       .from('posts')
       .on('INSERT', payload => {
           console.log('New post!', payload);
       })
       .subscribe();
   ```

## Conclusion
Integrating Supabase into your application provides a powerful way to manage PostgreSQL databases along with realtime capabilities. Follow these instructions for a smooth setup!