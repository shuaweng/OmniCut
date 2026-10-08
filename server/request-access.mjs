// Opening the public application shell from another app is a navigation, not
// permission to read project data or invoke a local API.
export function requestAccessError(req, pathname, port) {
 const origins=['http://localhost:'+port,'http://127.0.0.1:'+port];
 if(!['localhost:'+port,'127.0.0.1:'+port,'[::1]:'+port].includes(req.headers.host))return '仅允许本机访问';
 if(req.method!=='GET'&&req.headers.origin&&!origins.includes(req.headers.origin))return '不允许跨站修改';
 const publicNavigation=req.method==='GET'&&pathname==='/'&&req.headers['sec-fetch-mode']==='navigate'&&req.headers['sec-fetch-dest']==='document';
 if(req.headers['sec-fetch-site']==='cross-site'&&!publicNavigation)return '不允许跨站访问';
 return null;
}
