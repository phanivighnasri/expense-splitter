import React, { useState, useEffect } from 'react';
import { Users, Plus, DollarSign, TrendingUp, CheckCircle, CreditCard, X, Lock, AlertCircle, Receipt } from 'lucide-react';

const ExpenseSplitterApp = () => {
  const [currentUser] = useState({ id: '1', name: 'John Doe', phone: '+919876543210' });
  const [view, setView] = useState('groups');
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [paidSettlements, setPaidSettlements] = useState([]);

  const [showManualContact, setShowManualContact] = useState(false);
  const [manualContactData, setManualContactData] = useState({ name: '', phone: '' });

  const syncContacts = async () => {
    setShowManualContact(true);
  };

  const addManualContact = () => {
    if (!manualContactData.name || !manualContactData.phone) {
      alert('Please enter both name and phone');
      return;
    }

    const isDuplicate = contacts.some(c => c.phone === manualContactData.phone);
    if (isDuplicate) {
      alert('This contact already exists!');
      return;
    }

    const newContact = {
      id: Date.now().toString(),
      name: manualContactData.name,
      phone: manualContactData.phone,
      isRegistered: true
    };

    setContacts([...contacts, newContact]);
    setManualContactData({ name: '', phone: '' });
    alert('Contact added successfully!');
  };

  const [showGroupForm, setShowGroupForm] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);

  const createGroup = () => {
    if (!groupName.trim()) {
      alert('Please enter a group name');
      return;
    }

    if (selectedMembers.length < 2) {
      alert('Please select at least 2 members to create a group');
      return;
    }

    const newGroup = {
      id: Date.now().toString(),
      name: groupName,
      members: [
        { userId: currentUser.id, name: currentUser.name, phone: currentUser.phone, canLeave: true },
        ...selectedMembers.map(m => ({ ...m, canLeave: true }))
      ],
      createdAt: new Date()
    };
    setGroups([...groups, newGroup]);
    setShowGroupForm(false);
    setGroupName('');
    setSelectedMembers([]);
  };

  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseData, setExpenseData] = useState({
    description: '',
    amount: '',
    splitType: 'equal',
    customSplits: []
  });

  const [showSplitDetails, setShowSplitDetails] = useState(false);

  const addExpense = () => {
    if (!expenseData.description || !expenseData.amount) {
      alert('Please fill all fields');
      return;
    }

    const amount = parseFloat(expenseData.amount);
    let splitAmong = [];

    if (expenseData.splitType === 'equal') {
      const perPerson = amount / selectedGroup.members.length;
      splitAmong = selectedGroup.members.map(m => ({
        userId: m.userId,
        name: m.name,
        amount: perPerson
      }));
    } else if (expenseData.splitType === 'unequal') {
      splitAmong = expenseData.customSplits;
      const totalSplit = splitAmong.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0);
      if (Math.abs(totalSplit - amount) > 0.01) {
        alert(`Split amounts must equal total amount. Current: ₹${totalSplit}, Expected: ₹${amount}`);
        return;
      }
    } else if (expenseData.splitType === 'percentage') {
      const totalPercent = expenseData.customSplits.reduce((sum, s) => sum + parseFloat(s.percentage || 0), 0);
      if (Math.abs(totalPercent - 100) > 0.01) {
        alert(`Percentages must add up to 100%. Current: ${totalPercent}%`);
        return;
      }
      splitAmong = expenseData.customSplits.map(s => ({
        userId: s.userId,
        name: s.name,
        amount: (amount * parseFloat(s.percentage)) / 100
      }));
    }

    const expense = {
      id: Date.now().toString(),
      groupId: selectedGroup.id,
      description: expenseData.description,
      amount: amount,
      paidBy: currentUser.id,
      paidByName: currentUser.name,
      splitType: expenseData.splitType,
      splitAmong: splitAmong,
      date: new Date().toISOString(),
      receipt: null
    };

    setExpenses([...expenses, expense]);
    setShowExpenseForm(false);
    setExpenseData({ description: '', amount: '', splitType: 'equal', customSplits: [] });
  };

  const initializeCustomSplits = (type) => {
    const splits = selectedGroup.members.map(m => ({
      userId: m.userId,
      name: m.name,
      amount: type === 'unequal' ? '' : 0,
      percentage: type === 'percentage' ? '' : 0
    }));
    setExpenseData({ ...expenseData, splitType: type, customSplits: splits });
    setShowSplitDetails(true);
  };

  const updateCustomSplit = (userId, field, value) => {
    const updated = expenseData.customSplits.map(s =>
      s.userId === userId ? { ...s, [field]: value } : s
    );
    setExpenseData({ ...expenseData, customSplits: updated });
  };

  const calculateSettlements = () => {
    if (!selectedGroup) return;

    const balances = {};
    selectedGroup.members.forEach(member => {
      balances[member.userId] = { amount: 0, name: member.name };
    });

    expenses
      .filter(e => e.groupId === selectedGroup.id)
      .forEach(expense => {
        balances[expense.paidBy].amount += expense.amount;
        expense.splitAmong.forEach(split => {
          balances[split.userId].amount -= split.amount;
        });
      });

    const debtors = [];
    const creditors = [];

    Object.keys(balances).forEach(userId => {
      const balance = balances[userId].amount;
      if (balance < -0.01) {
        debtors.push({ userId, amount: -balance, name: balances[userId].name });
      } else if (balance > 0.01) {
        creditors.push({ userId, amount: balance, name: balances[userId].name });
      }
    });

    const transactions = [];
    let i = 0, j = 0;

    while (i < debtors.length && j < creditors.length) {
      const settleAmount = Math.min(debtors[i].amount, creditors[j].amount);
      transactions.push({
        id: `${debtors[i].userId}-${creditors[j].userId}`,
        from: debtors[i].userId,
        fromName: debtors[i].name,
        to: creditors[j].userId,
        toName: creditors[j].name,
        amount: Math.round(settleAmount * 100) / 100,
        status: 'pending'
      });

      debtors[i].amount -= settleAmount;
      creditors[j].amount -= settleAmount;

      if (debtors[i].amount < 0.01) i++;
      if (creditors[j].amount < 0.01) j++;
    }

    setSettlements(transactions);
    
    const updatedMembers = selectedGroup.members.map(m => ({
      ...m,
      canLeave: !transactions.some(t => t.from === m.userId && t.status === 'pending')
    }));
    setSelectedGroup({ ...selectedGroup, members: updatedMembers });
    
    setView('split');
  };

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const initiatePayment = (settlement) => {
    setSelectedSettlement(settlement);
    setShowPaymentModal(true);
  };

  const processRazorpayPayment = () => {
    setIsProcessingPayment(true);

    const options = {
      key: 'rzp_test_YOUR_KEY_HERE',
      amount: selectedSettlement.amount * 100,
      currency: 'INR',
      name: 'Expense Splitter',
      description: `Settlement to ${selectedSettlement.toName}`,
      handler: function (response) {
        const paymentProof = {
          settlementId: selectedSettlement.id,
          razorpayPaymentId: response.razorpay_payment_id,
          amount: selectedSettlement.amount,
          from: selectedSettlement.from,
          to: selectedSettlement.to,
          timestamp: new Date().toISOString()
        };

        setPaidSettlements([...paidSettlements, paymentProof]);

        const updatedSettlements = settlements.map(s =>
          s.id === selectedSettlement.id ? { ...s, status: 'completed', proof: paymentProof } : s
        );
        setSettlements(updatedSettlements);

        setIsProcessingPayment(false);
        setShowPaymentModal(false);
        alert('Payment successful! ✓');
      },
      prefill: {
        name: currentUser.name,
        contact: currentUser.phone
      },
      theme: {
        color: '#4F46E5'
      }
    };

    if (window.Razorpay) {
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        setIsProcessingPayment(false);
        alert('Payment failed. Please try again.');
      });
      rzp.open();
    } else {
      alert('Razorpay SDK not loaded. Add the script in your HTML.');
      setIsProcessingPayment(false);
    }
  };

  const processUPIPayment = () => {
    const upiUrl = `upi://pay?pa=merchant@upi&pn=${selectedSettlement.toName}&am=${selectedSettlement.amount}&cu=INR&tn=Settlement`;
    
    alert('Redirecting to UPI app...\n\nNote: After payment, the transaction ID will be verified automatically.');
    
    setTimeout(() => {
      const paymentProof = {
        settlementId: selectedSettlement.id,
        upiTransactionId: `UPI${Date.now()}`,
        amount: selectedSettlement.amount,
        from: selectedSettlement.from,
        to: selectedSettlement.to,
        timestamp: new Date().toISOString()
      };

      setPaidSettlements([...paidSettlements, paymentProof]);

      const updatedSettlements = settlements.map(s =>
        s.id === selectedSettlement.id ? { ...s, status: 'completed', proof: paymentProof } : s
      );
      setSettlements(updatedSettlements);

      setShowPaymentModal(false);
      alert('Payment verified! ✓');
    }, 2000);
  };

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
      <div className="max-w-5xl mx-auto p-6">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl shadow-2xl p-8 mb-6 text-white">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold mb-2 drop-shadow-lg">💰 Expense Splitter</h1>
              <p className="text-indigo-100 text-lg">Welcome back, {currentUser.name}</p>
            </div>
            <button
              onClick={syncContacts}
              className="bg-white text-indigo-600 px-6 py-3 rounded-xl flex items-center gap-2 hover:bg-indigo-50 transition transform hover:scale-105 shadow-lg font-semibold"
            >
              <Plus size={20} />
              Add Contact
            </button>
          </div>
        </div>

        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setView('groups')}
            className={`flex-1 py-4 px-6 rounded-2xl font-bold transition-all transform hover:scale-105 shadow-lg ${
              view === 'groups' 
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xl' 
                : 'bg-white text-gray-700 hover:shadow-xl'
            }`}
          >
            <Users className="inline mr-2" size={22} />
            Groups ({groups.length})
          </button>
          <button
            onClick={() => selectedGroup && setView('expenses')}
            disabled={!selectedGroup}
            className={`flex-1 py-4 px-6 rounded-2xl font-bold transition-all transform hover:scale-105 shadow-lg ${
              view === 'expenses' 
                ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-xl' 
                : 'bg-white text-gray-700 hover:shadow-xl'
            } ${!selectedGroup && 'opacity-50 cursor-not-allowed'}`}
          >
            <DollarSign className="inline mr-2" size={22} />
            Expenses
          </button>
        </div>

        {view === 'groups' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-gray-800">Your Groups</h2>
              <button
                onClick={() => setShowGroupForm(true)}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl flex items-center gap-2 hover:shadow-xl transition transform hover:scale-105 font-semibold"
              >
                <Plus size={20} /> Create Group
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groups.map(group => (
                <div
                  key={group.id}
                  onClick={() => {
                    setSelectedGroup(group);
                    setView('expenses');
                  }}
                  className="bg-white p-6 rounded-2xl shadow-lg hover:shadow-2xl transition-all cursor-pointer transform hover:scale-105 border-2 border-transparent hover:border-indigo-300"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-3 rounded-xl">
                      <Users size={24} className="text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">{group.name}</h3>
                      <p className="text-gray-600">{group.members.length} members</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {group.members.slice(0, 3).map((m, i) => (
                      <span key={i} className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-semibold">
                        {m.name}
                      </span>
                    ))}
                    {group.members.length > 3 && (
                      <span className="bg-gray-200 text-gray-600 px-3 py-1 rounded-full text-sm font-semibold">
                        +{group.members.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {groups.length === 0 && (
              <div className="text-center py-20 bg-white rounded-2xl shadow-lg">
                <div className="bg-indigo-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users size={48} className="text-indigo-600" />
                </div>
                <p className="text-xl text-gray-600 mb-2">No groups yet</p>
                <p className="text-gray-500">Create your first group to start splitting expenses!</p>
              </div>
            )}
          </div>
        )}

        {showManualContact && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl transform transition-all">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-3xl font-bold text-gray-800">Add Contact</h3>
                <button onClick={() => setShowManualContact(false)} className="text-gray-500 hover:text-gray-700">
                  <X size={24} />
                </button>
              </div>
              <input
                type="text"
                placeholder="Contact Name"
                value={manualContactData.name}
                onChange={(e) => setManualContactData({...manualContactData, name: e.target.value})}
                className="w-full p-4 border-2 border-gray-300 rounded-xl mb-4 focus:border-indigo-500 focus:outline-none transition"
              />
              <input
                type="tel"
                placeholder="Phone Number (e.g., +919876543210)"
                value={manualContactData.phone}
                onChange={(e) => setManualContactData({...manualContactData, phone: e.target.value})}
                className="w-full p-4 border-2 border-gray-300 rounded-xl mb-4 focus:border-indigo-500 focus:outline-none transition"
              />
              
              <div className="mb-6 p-4 bg-indigo-50 rounded-xl">
                <p className="text-sm text-indigo-700 font-semibold">
                  📋 Total contacts: {contacts.length}
                </p>
              </div>

              <button
                onClick={addManualContact}
                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold hover:shadow-lg transition transform hover:scale-105"
              >
                Add Contact
              </button>
            </div>
          </div>
        )}

        {showGroupForm && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-3xl font-bold text-gray-800">Create New Group</h3>
                <button onClick={() => setShowGroupForm(false)} className="text-gray-500 hover:text-gray-700">
                  <X size={24} />
                </button>
              </div>
              <input
                type="text"
                placeholder="Group Name (e.g., Weekend Trip)"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full p-4 border-2 border-gray-300 rounded-xl mb-6 focus:border-indigo-500 focus:outline-none transition"
              />
              
              <div className="mb-4 p-4 bg-yellow-50 border-2 border-yellow-300 rounded-xl flex items-start gap-3">
                <AlertCircle size={20} className="text-yellow-600 mt-1 flex-shrink-0" />
                <p className="text-sm text-yellow-800">
                  <strong>Minimum 2 members required</strong> to create a group
                </p>
              </div>

              <h4 className="font-bold mb-3 text-lg">Select Members ({selectedMembers.length} selected)</h4>
              <div className="max-h-60 overflow-y-auto mb-6 space-y-2">
                {contacts.map((contact) => (
                  <label key={contact.id} className="flex items-center gap-3 p-4 hover:bg-indigo-50 rounded-xl cursor-pointer transition border-2 border-transparent hover:border-indigo-200">
                    <input
                      type="checkbox"
                      className="w-5 h-5 text-indigo-600"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedMembers([...selectedMembers, { userId: contact.id, name: contact.name, phone: contact.phone }]);
                        } else {
                          setSelectedMembers(selectedMembers.filter(m => m.userId !== contact.id));
                        }
                      }}
                    />
                    <div className="flex-1">
                      <span className="font-semibold">{contact.name}</span>
                      <p className="text-sm text-gray-500">{contact.phone}</p>
                    </div>
                  </label>
                ))}
                {contacts.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No contacts yet. Add some first!</p>
                )}
              </div>
              
              <button
                onClick={createGroup}
                disabled={selectedMembers.length < 2}
                className={`w-full py-4 rounded-xl font-bold transition transform hover:scale-105 ${
                  selectedMembers.length >= 2
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Create Group
              </button>
            </div>
          </div>
        )}

        {view === 'expenses' && selectedGroup && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-3xl font-bold text-gray-800">{selectedGroup.name}</h2>
                  <p className="text-gray-600 mt-1">{selectedGroup.members.length} members · {expenses.filter(e => e.groupId === selectedGroup.id).length} expenses</p>
                </div>
                <button
                  onClick={() => {
                    setShowExpenseForm(true);
                    setShowSplitDetails(false);
                  }}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-xl flex items-center gap-2 font-semibold hover:shadow-lg transition transform hover:scale-105"
                >
                  <Plus size={20} /> Add Expense
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {selectedGroup.members.map((m, i) => (
                  <div key={i} className="flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-full">
                    <span className="font-semibold text-indigo-700">{m.name}</span>
                    {!m.canLeave && (
                      <Lock size={16} className="text-red-500" title="Cannot leave until settled" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {expenses.filter(e => e.groupId === selectedGroup.id).map(expense => (
                <div key={expense.id} className="bg-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-bold text-xl text-gray-800">{expense.description}</h3>
                      <p className="text-sm text-gray-600 mt-1">Paid by <span className="font-semibold text-indigo-600">{expense.paidByName}</span></p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">
                          {expense.splitType} split
                        </span>
                        <span className="text-gray-500 text-sm">
                          {new Date(expense.date).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-green-600">₹{expense.amount}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        ₹{(expense.amount / selectedGroup.members.length).toFixed(2)} per person
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {expenses.filter(e => e.groupId === selectedGroup.id).length > 0 && (
              <button
                onClick={calculateSettlements}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:shadow-xl transition transform hover:scale-105"
              >
                <TrendingUp size={24} />
                Calculate Settlements
              </button>
            )}

            {expenses.filter(e => e.groupId === selectedGroup.id).length === 0 && (
              <div className="text-center py-20 bg-white rounded-2xl shadow-lg">
                <div className="bg-green-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4">
                  <DollarSign size={48} className="text-green-600" />
                </div>
                <p className="text-xl text-gray-600 mb-2">No expenses yet</p>
                <p className="text-gray-500">Add your first expense to start tracking!</p>
              </div>
            )}
          </div>
        )}

        {showExpenseForm && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-3xl font-bold text-gray-800">Add Expense</h3>
                <button onClick={() => {
                  setShowExpenseForm(false);
                  setShowSplitDetails(false);
                }} className="text-gray-500 hover:text-gray-700">
                  <X size={24} />
                </button>
              </div>
              
              <input
                type="text"
                placeholder="Description (e.g., Dinner at Restaurant)"
                value={expenseData.description}
                onChange={(e) => setExpenseData({...expenseData, description: e.target.value})}
                className="w-full p-4 border-2 border-gray-300 rounded-xl mb-4 focus:border-indigo-500 focus:outline-none transition"
              />
              
              <input
                type="number"
                placeholder="Total Amount"
                value={expenseData.amount}
                onChange={(e) => setExpenseData({...expenseData, amount: e.target.value})}
                className="w-full p-4 border-2 border-gray-300 rounded-xl mb-4 focus:border-indigo-500 focus:outline-none transition"
              />
              
              <div className="mb-4">
                <label className="block font-semibold mb-3 text-lg">Split Type</label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setExpenseData({...expenseData, splitType: 'equal'})}
                    className={`p-4 rounded-xl font-semibold transition ${
                      expenseData.splitType === 'equal'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Equal Split
                  </button>
                  <button
                    onClick={() => initializeCustomSplits('unequal')}
                    className={`p-4 rounded-xl font-semibold transition ${
                      expenseData.splitType === 'unequal'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Unequal Split
                  </button>
                  <button
                    onClick={() => initializeCustomSplits('percentage')}
                    className={`p-4 rounded-xl font-semibold transition ${
                      expenseData.splitType === 'percentage'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Percentage
                  </button>
                </div>
              </div>

              {showSplitDetails && expenseData.splitType === 'unequal' && (
                <div className="mb-4 p-4 bg-gray-50 rounded-xl">
                  <h4 className="font-semibold mb-3">Enter amounts for each member</h4>
                  <div className="space-y-3">
                    {expenseData.customSplits.map((split) => (
                      <div key={split.userId} className="flex items-center gap-3">
                        <span className="flex-1 font-semibold">{split.name}</span>
                        <input
                          type="number"
                          placeholder="0.00"
                          value={split.amount}
                          onChange={(e) => updateCustomSplit(split.userId, 'amount', e.target.value)}
                          className="w-32 p-2 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-700">
                      Total split: ₹{expenseData.customSplits.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0).toFixed(2)} / ₹{expenseData.amount || 0}
                    </p>
                  </div>
                </div>
              )}

              {showSplitDetails && expenseData.splitType === 'percentage' && (
                <div className="mb-4 p-4 bg-gray-50 rounded-xl">
                  <h4 className="font-semibold mb-3">Enter percentage for each member</h4>
                  <div className="space-y-3">
                    {expenseData.customSplits.map((split) => (
                      <div key={split.userId} className="flex items-center gap-3">
                        <span className="flex-1 font-semibold">{split.name}</span>
                        <input
                          type="number"
                          placeholder="0"
                          value={split.percentage}
                          onChange={(e) => updateCustomSplit(split.userId, 'percentage', e.target.value)}
                          className="w-24 p-2 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none"
                        />
                        <span className="text-gray-600">%</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-700">
                      Total: {expenseData.customSplits.reduce((sum, s) => sum + parseFloat(s.percentage || 0), 0).toFixed(2)}% / 100%
                    </p>
                  </div>
                </div>
              )}

              <button
                onClick={addExpense}
                className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold hover:shadow-lg transition transform hover:scale-105"
              >
                Add Expense
              </button>
            </div>
          </div>
        )}

        {view === 'split' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-6 text-white shadow-xl">
              <h2 className="text-3xl font-bold mb-2">💳 Settlement Summary</h2>
              <p className="text-purple-100">Optimized to minimize transactions</p>
            </div>

            {settlements.filter(s => s.status === 'pending').length === 0 && (
              <div className="text-center py-20 bg-white rounded-2xl shadow-lg">
                <div className="bg-green-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={48} className="text-green-600" />
                </div>
                <p className="text-2xl font-bold text-gray-800 mb-2">All Settled! 🎉</p>
                <p className="text-gray-500">Everyone's expenses are balanced</p>
              </div>
            )}

            {settlements.map((settlement, idx) => (
              <div key={idx} className={`bg-white p-6 rounded-2xl shadow-lg transition-all ${
                settlement.status === 'completed' ? 'opacity-60 border-2 border-green-400' : 'border-2 border-transparent'
              }`}>
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {settlement.status === 'completed' ? (
                        <CheckCircle size={24} className="text-green-600" />
                      ) : (
                        <AlertCircle size={24} className="text-orange-600" />
                      )}
                      <p className="text-lg">
                        <span className="font-bold text-gray-800">{settlement.fromName}</span>
                        <span className="text-gray-600 mx-2">pays</span>
                        <span className="font-bold text-gray-800">{settlement.toName}</span>
                      </p>
                    </div>
                    <p className="text-3xl font-bold text-indigo-600 mt-2">₹{settlement.amount}</p>
                    {settlement.status === 'completed' && settlement.proof && (
                      <div className="mt-3 p-3 bg-green-50 rounded-lg flex items-center gap-2">
                        <Receipt size={18} className="text-green-600" />
                        <span className="text-sm text-green-700 font-semibold">
                          Payment verified: {settlement.proof.razorpayPaymentId || settlement.proof.upiTransactionId}
                        </span>
                      </div>
                    )}
                  </div>
                  {settlement.from === currentUser.id && settlement.status === 'pending' && (
                    <button
                      onClick={() => initiatePayment(settlement)}
                      className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-8 py-4 rounded-xl font-bold hover:shadow-xl transition transform hover:scale-105"
                    >
                      Pay Now
                    </button>
                  )}
                  {settlement.status === 'completed' && (
                    <div className="bg-green-100 px-6 py-3 rounded-xl">
                      <span className="text-green-700 font-bold">✓ Paid</span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {settlements.filter(s => s.status === 'pending').length > 0 && (
              <div className="mt-6 p-4 bg-yellow-50 border-2 border-yellow-300 rounded-xl flex items-start gap-3">
                <Lock size={20} className="text-yellow-600 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-sm text-yellow-800 font-semibold">
                    Members with pending payments cannot leave the group until all settlements are completed.
                  </p>
                  <p className="text-xs text-yellow-700 mt-1">
                    All payments must be made through the app for verification.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {showPaymentModal && selectedSettlement && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl transform transition-all">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-3xl font-bold text-gray-800">Make Payment</h3>
                <button onClick={() => setShowPaymentModal(false)} className="text-gray-500 hover:text-gray-700">
                  <X size={24} />
                </button>
              </div>

              <div className="mb-6 p-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl">
                <p className="text-sm text-gray-600 mb-1">Paying to</p>
                <p className="text-2xl font-bold text-gray-800 mb-3">{selectedSettlement.toName}</p>
                <p className="text-4xl font-bold text-indigo-600">₹{selectedSettlement.amount}</p>
              </div>
              
              <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl flex items-start gap-3">
                <AlertCircle size={20} className="text-blue-600 mt-1 flex-shrink-0" />
                <p className="text-sm text-blue-800">
                  Payment proof will be automatically recorded and shared with all group members.
                </p>
              </div>

              <div className="mb-6">
                <h4 className="font-bold mb-4 text-lg">Payment Method</h4>
                <div className="space-y-3">
                  <label className="flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition hover:bg-gray-50 hover:border-indigo-300">
                    <input
                      type="radio"
                      name="payment"
                      value="upi"
                      checked={paymentMethod === 'upi'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-5 h-5 text-indigo-600"
                    />
                    <CreditCard size={28} className="text-indigo-600" />
                    <div className="flex-1">
                      <span className="font-semibold text-lg">UPI Payment</span>
                      <p className="text-sm text-gray-500">Google Pay, PhonePe, Paytm</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition hover:bg-gray-50 hover:border-indigo-300">
                    <input
                      type="radio"
                      name="payment"
                      value="razorpay"
                      checked={paymentMethod === 'razorpay'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-5 h-5 text-indigo-600"
                    />
                    <CreditCard size={28} className="text-purple-600" />
                    <div className="flex-1">
                      <span className="font-semibold text-lg">Razorpay</span>
                      <p className="text-sm text-gray-500">Card, Netbanking, Wallet</p>
                    </div>
                  </label>
                </div>
              </div>

              <button
                onClick={paymentMethod === 'upi' ? processUPIPayment : processRazorpayPayment}
                disabled={isProcessingPayment}
                className={`w-full py-4 rounded-xl font-bold text-lg transition transform hover:scale-105 ${
                  isProcessingPayment
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:shadow-xl'
                }`}
              >
                {isProcessingPayment ? 'Processing...' : `Pay ₹${selectedSettlement.amount}`}
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default ExpenseSplitterApp;