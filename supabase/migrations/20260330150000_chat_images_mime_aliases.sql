begin;

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/x-png',
  'image/gif',
  'image/webp'
]
where id = 'chat-images';

commit;
