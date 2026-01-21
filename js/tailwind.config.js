tailwind.config = {
    theme: {
        extend: {
            colors: {
                primary: '#1a56db',
                secondary: '#e2e8f0',
                success: '#10b981',
                danger: '#ef4444',
                warning: '#f59e0b',
                info: '#3b82f6',
                light: '#f8fafc',
                dark: '#1e293b'
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif']
            },
            boxShadow: {
                card: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
            }
        }
    }
}