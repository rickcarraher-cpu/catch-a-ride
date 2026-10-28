import { getToken } from '@auth/core/jwt';
export async function GET(request) {
	const isSecure = process.env.AUTH_URL?.startsWith('https') ?? request.url?.startsWith('https') ?? false;
	const [token, jwt] = await Promise.all([
		getToken({
			req: request,
			secret: process.env.AUTH_SECRET,
			secureCookie: isSecure,
			raw: true,
		}),
		getToken({
			req: request,
			secret: process.env.AUTH_SECRET,
			secureCookie: isSecure,
		}),
	]);

	if (!jwt) {
		return new Response(
			`
			<html>
				<body>
					<script>
						(function () {
							var message = { type: 'AUTH_ERROR', error: 'Unauthorized' };
							if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
								window.ReactNativeWebView.postMessage(JSON.stringify(message));
							}
							if (window.parent && window.parent !== window) {
								window.parent.postMessage(message, '*');
							}
						})();
					</script>
				</body>
			</html>
			`,
			{
				status: 401,
				headers: {
					'Content-Type': 'text/html',
				},
			}
		);
	}

	const message = {
		type: 'AUTH_SUCCESS',
		jwt: token,
		user: {
			id: jwt.sub,
			email: jwt.email,
			name: jwt.name,
		},
	};

	return new Response(
		`
		<html>
			<body>
				<script>
					(function () {
						var message = ${JSON.stringify(message)};
						if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
							window.ReactNativeWebView.postMessage(JSON.stringify(message));
						}
						if (window.parent && window.parent !== window) {
							window.parent.postMessage(message, '*');
						} else {
							window.location.replace('/api/auth/token');
						}
					})();
				</script>
			</body>
		</html>
		`,
		{
			headers: {
				'Content-Type': 'text/html',
			},
		}
	);
}
