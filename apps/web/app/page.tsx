export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-green-700 mb-4">🌾 CropCoin</h1>
        <p className="text-2xl text-gray-700 mb-8">Agricultural Finance Platform</p>
        <p className="text-gray-600 mb-8">Empowering smallholder farmers across East Africa</p>
        <a
          href="/login"
          className="inline-block bg-green-600 hover:bg-green-700 text-white font-medium px-8 py-3 rounded-lg transition"
        >
          Get Started
        </a>
      </div>
    </main>
  );
}
