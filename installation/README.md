# Installation

A laptop hosts the monitor display and iPad controller. Requires Node.js 22+ and both devices on the same local network.

```sh
cd installation
npm ci
npm start
```

- **Laptop:** open `http://localhost:7777/display.html` on the monitor.
- **iPad:** open `http://LAPTOP_IP:7777/controller.html`. Find the address at `http://localhost:7777`.
- Draw a pattern and tap **Fly To**. Drag or pinch the preview to explore; navigation locks during flights.
- Tap **Full screen**, or use Safari’s **Add to Home Screen** if unavailable.

Keep the laptop awake and the display visible. If connection fails, check the firewall and network device isolation. Use a trusted local network; the server has no authentication. Reload pages after client changes; restart the server after server changes. Server restarts reset the session.

Optional: `HOST=0.0.0.0 PORT=7777 npm start`. Run checks with `npm test`.
