import base64, json, hmac, hashlib, time
s = base64.b64decode('cW9m4CaWU2l3RPlBAx6Nby/tQZ1CYD5H4SYFCQPXMky/hPtxosIZWRUs/4hXPCv+utVIUO6kSQ7vf4j2pdjPkA==')
h = base64.urlsafe_b64encode(json.dumps({'alg':'HS256','typ':'JWT'}, separators=(',',':')).encode()).rstrip(b'=').decode()
p = base64.urlsafe_b64encode(json.dumps({'role':'service_role','iss':'supabase','iat':int(time.time()),'exp':int(time.time())+315360000}, separators=(',',':')).encode()).rstrip(b'=').decode()
sig = hmac.new(s, f'{h}.{p}'.encode(), hashlib.sha256).digest()
print(f'{h}.{p}.{base64.urlsafe_b64encode(sig).rstrip(b"=").decode()}')
