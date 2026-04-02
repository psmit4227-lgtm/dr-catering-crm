export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-lg p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">New Order</h1>
        <p className="text-gray-400 text-sm mb-8">Fill this in during the call</p>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Client name</label>
            <input type="text" placeholder="Who is calling?" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-black"/>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Phone number</label>
            <input type="tel" placeholder="201-555-0000" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-black"/>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">What do they want?</label>
            <textarea placeholder="e.g. 40 chicken skewers, 10 hummus platters" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-black h-28 resize-none"/>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Delivery date</label>
              <input type="date" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"/>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Delivery time</label>
              <input type="time" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"/>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Delivery address</label>
            <input type="text" placeholder="Full address" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-black"/>
          </div>

          <button className="w-full bg-black text-white rounded-xl py-4 font-semibold text-lg hover:bg-gray-800 transition-colors">
            Save order
          </button>
        </div>
      </div>
    </main>
  );
}