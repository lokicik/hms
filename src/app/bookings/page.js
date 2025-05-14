"use client";

import { useState, useEffect } from "react";
import {
  Table,
  Button,
  Space,
  Tag,
  Tabs,
  Drawer,
  Form,
  Input,
  DatePicker,
  Select,
  Spin,
  Alert,
  message,
  InputNumber,
  Descriptions,
  Badge,
  Tooltip,
  Divider,
  Transfer,
  Switch,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  EyeOutlined,
  CheckOutlined,
  CloseOutlined,
  InfoCircleOutlined,
  PercentageOutlined,
} from "@ant-design/icons";
import AppLayout from "@/components/AppLayout";
import dayjs from "dayjs";
import { useSearchParams } from "next/navigation";
import {
  initializeGoogleSheets,
  authenticateUser,
  getBookingsData,
  getRoomsData,
  addBooking,
  updateBooking,
  getAvailableRooms,
  getPricesData,
  calculatePriceWithRules,
} from "@/utils/googleSheets";

const { Option } = Select;
const { RangePicker } = DatePicker;

export default function BookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null);
  const [viewingBooking, setViewingBooking] = useState(null);
  const [drawerTitle, setDrawerTitle] = useState("");
  const [drawerType, setDrawerType] = useState("view"); // 'view', 'new', 'edit'
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState("active");
  const [isInitializing, setIsInitializing] = useState(true);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [selectedTotalPrice, setSelectedTotalPrice] = useState(0);
  const [selectedPriceInfo, setSelectedPriceInfo] = useState(null);
  const [availableRules, setAvailableRules] = useState([]);
  const [targetSelectedRules, setTargetSelectedRules] = useState([]);
  const [manualPriceRules, setManualPriceRules] = useState(false);
  const [priceDisplay, setPriceDisplay] = useState({
    basePrice: 0,
    finalPrice: 0,
    nights: 0,
    totalPrice: 0,
    hasDiscount: false,
    hasPremium: false,
    percentageChange: 0,
  });
  const searchParams = useSearchParams();

  useEffect(() => {
    const initializeAndFetch = async () => {
      try {
        await initializeGoogleSheets();
        await authenticateUser();
        setIsInitializing(false);
        await fetchData();

        // Check if we need to open the new booking drawer
        const action = searchParams.get("action");
        const roomId = searchParams.get("roomId");

        if (action === "new" && roomId) {
          const room = rooms.find((r) => r.id === roomId);
          if (room) {
            handleShowDrawer("new");
            form.setFieldsValue({ roomId });
          }
        }
      } catch (error) {
        console.error("Error initializing Google Sheets API:", error);
        setError("Failed to initialize Google Sheets API. Please try again.");
        setIsInitializing(false);
        setLoading(false);
      }
    };

    initializeAndFetch();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch rooms and bookings data from Google Sheets
      const [roomsData, bookingsData] = await Promise.all([
        getRoomsData(),
        getBookingsData(),
      ]);

      // Add room number to bookings data
      const enrichedBookings = bookingsData.map((booking) => {
        const room = roomsData.find((r) => r.id === booking.roomId);
        return {
          ...booking,
          roomNumber: room ? room.number : "Unknown",
        };
      });

      setRooms(roomsData);
      setBookings(enrichedBookings);
    } catch (err) {
      setError("Failed to load bookings");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleShowDrawer = (type, booking = null) => {
    setDrawerType(type);

    if (type === "view") {
      setViewingBooking(booking);
      setDrawerTitle("Booking Details");
    } else if (type === "new") {
      form.resetFields();
      setEditingBooking(null);
      setDrawerTitle("Create New Booking");
    } else if (type === "edit") {
      setEditingBooking(booking);
      form.setFieldsValue({
        ...booking,
        dateRange: [dayjs(booking.checkIn), dayjs(booking.checkOut)],
      });
      setDrawerTitle("Edit Booking");
    }

    setDrawerVisible(true);
  };

  const handleCloseDrawer = () => {
    setDrawerVisible(false);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const [checkIn, checkOut] = values.dateRange;

      // Use the calculated value from the display rather than recalculating it
      const bookingData = {
        ...values,
        checkIn: checkIn.format("YYYY-MM-DD"),
        checkOut: checkOut.format("YYYY-MM-DD"),
        // Use the price that's shown in the UI
        totalPrice: priceDisplay.totalPrice,
        basePrice: priceDisplay.basePrice,
        pricePerNight: priceDisplay.finalPrice,
        nights: priceDisplay.nights,
        selectedRuleIds: manualPriceRules ? targetSelectedRules : [],
        notes: values.notes || "",
      };

      delete bookingData.dateRange;

      if (drawerType === "edit" && editingBooking) {
        // Update existing booking
        await updateBooking(editingBooking.id, bookingData);
        message.success("Booking updated successfully");
      } else {
        // Create new booking
        await addBooking(bookingData);
        message.success("Booking created successfully");
      }

      setDrawerVisible(false);
      fetchData();
    } catch (err) {
      console.error("Validation failed:", err);
    }
  };

  const handleCheckout = async (id) => {
    try {
      const booking = bookings.find((b) => b.id === id);
      if (booking) {
        await updateBooking(id, { ...booking, status: "checked-out" });
        message.success("Guest checked out successfully");
        fetchData();
      }
    } catch (error) {
      message.error("Failed to check out guest");
      console.error(error);
    }
  };

  const handleCancel = async (id) => {
    try {
      const booking = bookings.find((b) => b.id === id);
      if (booking) {
        // Ensure all required price information is included
        const bookingToUpdate = {
          ...booking,
          status: "cancelled",
          basePrice: booking.basePrice || 0,
          pricePerNight: booking.pricePerNight || 0,
          totalPrice: booking.totalPrice || 0,
          priceRuleApplied: booking.priceRuleApplied || false
        };
        await updateBooking(id, bookingToUpdate);
        message.success("Booking cancelled successfully");
        fetchData();
      }
    } catch (error) {
      message.error("Failed to cancel booking");
      console.error(error);
    }
  };

  const handleDateRangeChange = async (dates) => {
    if (!dates || dates.length !== 2) {
      return;
    }

    try {
      const [checkIn, checkOut] = dates;
      const checkInDate = checkIn.format("YYYY-MM-DD");
      const checkOutDate = checkOut.format("YYYY-MM-DD");

      // Disable the room selection until we get the available rooms
      form.resetFields(["roomId"]);

      // Reset price info when dates change
      resetPriceDisplay();

      // Check if we have guest count selected
      const guestCount = form.getFieldValue("guestCount") || 1;

      // Get available rooms for the selected date range
      const availableRoomsData = await getAvailableRooms(
        checkInDate,
        checkOutDate,
        guestCount,
        manualPriceRules ? targetSelectedRules : []
      );

      setAvailableRooms(availableRoomsData);

      // If we're in manual rule selection mode, also fetch any applicable rules
      if (manualPriceRules) {
        const fetchApplicableRules = async () => {
          try {
            // Get prices data
            const prices = await getPricesData();

            // Filter for rules that might be applicable
            const applicableRules = prices.filter(
              (p) =>
                (p.roomId === "all" ||
                  p.roomId === form.getFieldValue("roomId")) &&
                datesOverlap(p.startDate, p.endDate, checkInDate, checkOutDate)
            );

            const formattedRules = applicableRules.map((rule) => ({
              key: rule.id,
              title: `${rule.name}: ${formatRuleDescription(rule)}`,
              description: `${rule.startDate} to ${rule.endDate}`,
              rule: rule,
            }));

            setAvailableRules(formattedRules);

            // If we have previously selected rules, recalculate price with the new dates
            if (
              targetSelectedRules.length > 0 &&
              form.getFieldValue("roomId")
            ) {
              const selectedRoom = availableRoomsData.find(
                (r) => r.id === form.getFieldValue("roomId")
              );

              if (selectedRoom) {
                const basePrice = parseFloat(selectedRoom.basePrice) || 0;
                const nights = parseInt(selectedRoom.nights) || 0;

                // Get the full rule objects for selected IDs
                const selectedRules = formattedRules
                  .filter((rule) => targetSelectedRules.includes(rule.key))
                  .map((item) => item.rule);

                // Calculate with the new dates
                const newPrice = calculatePriceWithRules(
                  basePrice,
                  selectedRules,
                  targetSelectedRules,
                  checkIn.toDate(),
                  checkOut.toDate()
                );

                // Update price display
                updatePriceDisplay(basePrice, newPrice, nights);

                // Update total price
                const totalPrice = newPrice * nights;
                setSelectedTotalPrice(totalPrice);

                // Update selected price info
                setSelectedPriceInfo({
                  basePrice,
                  appliedPrice: newPrice,
                  isPriceRuleApplied: basePrice !== newPrice,
                  nights,
                  totalPrice,
                });
              }
            }
          } catch (error) {
            console.error("Error fetching pricing rules:", error);
          }
        };

        fetchApplicableRules();
      }

      if (availableRoomsData.length === 0) {
        message.warn("No rooms available for the selected dates");
      } else {
        message.success(
          `${availableRoomsData.length} rooms available for the selected dates`
        );
      }
    } catch (error) {
      console.error("Error finding available rooms:", error);
      message.error("Failed to find available rooms");
    }
  };

  const handleGuestCountChange = async (value) => {
    const dateRange = form.getFieldValue("dateRange");
    if (!dateRange || dateRange.length !== 2) return;

    // Reset room selection first
    form.setFieldsValue({ roomId: undefined });

    // Reset price display values
    resetPriceDisplay();

    // Show loading state
    setLoading(true);

    const [checkIn, checkOut] = dateRange;

    try {
      const availableRoomsData = await getAvailableRooms(
        checkIn.format("YYYY-MM-DD"),
        checkOut.format("YYYY-MM-DD"),
        value
      );

      setAvailableRooms(availableRoomsData);

      // Reset the total price when available rooms change
      setSelectedTotalPrice(0);
      setSelectedPriceInfo(null);

      // If there's only one room available, auto-select it
      if (availableRoomsData.length === 1) {
        form.setFieldsValue({ roomId: availableRoomsData[0].id });
        handleRoomSelect(availableRoomsData[0].id);
      }
    } catch (error) {
      console.error("Error fetching available rooms:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRoomSelect = async (roomId) => {
    const room = availableRooms.find((r) => r.id === roomId);
    if (room) {
      // Get current values from form
      const dateRange = form.getFieldValue("dateRange");
      const [checkIn, checkOut] = dateRange || [];

      // Calculate the number of nights from the date range
      let nights = 1; // Default to 1
      if (checkIn && checkOut) {
        // Calculate nights properly from the actual date range
        const checkInDate = checkIn.toDate();
        const checkOutDate = checkOut.toDate();
        nights = Math.ceil(
          (checkOutDate - checkInDate) / (1000 * 60 * 60 * 24)
        );
      }

      // Immediately update price display with available data
      // This provides instant feedback while async operations complete
      const basePrice = parseFloat(room.basePrice) || 0;
      const pricePerNight = parseFloat(room.pricePerNight) || basePrice;
      const totalPrice = pricePerNight * nights;

      // Update price display immediately
      updatePriceDisplay(basePrice, pricePerNight, nights);
      setSelectedTotalPrice(totalPrice);

      if (checkIn && checkOut) {
        const startDate = checkIn.format("YYYY-MM-DD");
        const endDate = checkOut.format("YYYY-MM-DD");

        try {
          // Get the applicable rules for this room and date range
          const allRules = await getPricesData();
          const applicableRules = allRules.filter(
            (rule) =>
              (rule.roomId === roomId || rule.roomId === "all") &&
              datesOverlap(rule.startDate, rule.endDate, startDate, endDate)
          );

          // Format applicable rules for the transfer component
          const formattedRules = applicableRules.map((rule) => ({
            key: rule.id,
            title: rule.name || `Rule ${rule.id}`,
            description:
              formatRuleDescription(rule) +
              ` (${rule.startDate} to ${rule.endDate})`,
            rule,
          }));

          setAvailableRules(formattedRules);

          // If in manual mode, check if any previously selected rules are no longer applicable
          if (manualPriceRules && targetSelectedRules.length > 0) {
            const newApplicableRuleIds = formattedRules.map((r) => r.key);
            const validSelectedRules = targetSelectedRules.filter((id) =>
              newApplicableRuleIds.includes(id)
            );

            if (validSelectedRules.length !== targetSelectedRules.length) {
              message.info(
                "Some selected pricing rules are no longer applicable for this room"
              );
              setTargetSelectedRules(validSelectedRules);
            }
          }
        } catch (error) {
          console.error("Error updating room pricing:", error);
        }
      } else {
        // If no dates selected, we can't determine applicable rules - show message if manual mode
        if (manualPriceRules) {
          message.info("Please select dates to see applicable pricing rules");
          setAvailableRules([]);
        }

        // Reset selected rules when room changes
        setTargetSelectedRules([]);
      }

      // Store information about the price
      setSelectedPriceInfo({
        basePrice: basePrice,
        appliedPrice: pricePerNight,
        isPriceRuleApplied: basePrice !== pricePerNight,
        nights: nights,
        totalPrice: totalPrice,
      });
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return "green";
      case "checked-out":
        return "blue";
      case "cancelled":
        return "red";
      default:
        return "default";
    }
  };

  const fetchPriceRules = async () => {
    try {
      const priceRules = await getPricesData();

      // Format rules for the transfer component
      const formattedRules = priceRules.map((rule) => ({
        key: rule.id,
        title: rule.name || `Rule ${rule.id}`,
        description: formatRuleDescription(rule),
        rule,
        disabled: false, // Make sure rules aren't disabled by default
      }));

      setAvailableRules(formattedRules);
    } catch (error) {
      console.error("Error fetching price rules:", error);
    }
  };

  const formatRuleDescription = (rule) => {
    if (rule.priceType === "fixed") {
      return `Fixed: $${rule.priceValue}`;
    } else {
      const prefix = rule.priceValue > 0 ? "+" : "";
      return `${prefix}${rule.priceValue}%`;
    }
  };

  const updatePriceDisplay = (basePrice, finalPrice, nights) => {
    // Ensure we have valid numeric values
    basePrice = parseFloat(basePrice) || 0;
    finalPrice = parseFloat(finalPrice) || 0;
    nights = parseInt(nights) || 1;

    const totalPrice = finalPrice * nights;
    const difference = finalPrice - basePrice;
    const percentageChange = basePrice > 0 ? (difference / basePrice) * 100 : 0;

    setPriceDisplay({
      basePrice,
      finalPrice,
      nights,
      totalPrice,
      hasDiscount: finalPrice < basePrice,
      hasPremium: finalPrice > basePrice,
      percentageChange: Math.abs(percentageChange),
    });
  };

  const handleRuleSelectionChange = (targetKeys) => {
    setTargetSelectedRules(targetKeys);

    // Recalculate price based on selected rules
    const selectedRoom = availableRooms.find(
      (r) => r.id === form.getFieldValue("roomId")
    );

    // Get date range
    const dateRange = form.getFieldValue("dateRange");
    if (!dateRange || !dateRange[0] || !dateRange[1]) {
      return;
    }

    // Convert from dayjs to dates
    const checkIn = dateRange[0].toDate();
    const checkOut = dateRange[1].toDate();

    // Calculate the correct number of nights
    const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

    if (selectedRoom) {
      const basePrice = parseFloat(selectedRoom.basePrice) || 0;

      // Get full rule objects for the selected IDs
      const selectedRules = availableRules
        .filter((rule) => targetKeys.includes(rule.key))
        .map((item) => item.rule);

      // Calculate the new price with selected rules - now passing dates
      const newPrice = calculatePriceWithRules(
        basePrice,
        selectedRules,
        targetKeys,
        checkIn,
        checkOut
      );

      // Update the price display
      updatePriceDisplay(basePrice, newPrice, nights);

      // Update total price
      const totalPrice = newPrice * nights;
      setSelectedTotalPrice(totalPrice);

      // Update price info
      setSelectedPriceInfo({
        basePrice,
        appliedPrice: newPrice,
        isPriceRuleApplied: basePrice !== newPrice,
        nights,
        totalPrice,
      });
    }
  };

  // Add this to make sure pricing rules are loaded when the drawer opens
  useEffect(() => {
    if (drawerVisible && (drawerType === "new" || drawerType === "edit")) {
      fetchPriceRules();
    }
  }, [drawerVisible, drawerType]);

  // Helper function to check if date ranges overlap
  const datesOverlap = (ruleStart, ruleEnd, bookingStart, bookingEnd) => {
    // Convert strings to Date objects
    const rStart = new Date(ruleStart);
    const rEnd = new Date(ruleEnd);
    const bStart = new Date(bookingStart);
    const bEnd = new Date(bookingEnd);

    // Check for any overlap between the ranges
    return (
      // Rule starts during booking
      (rStart >= bStart && rStart <= bEnd) ||
      // Rule ends during booking
      (rEnd >= bStart && rEnd <= bEnd) ||
      // Rule surrounds booking
      (rStart <= bStart && rEnd >= bEnd)
    );
  };

  const columns = [
    {
      title: "Room",
      dataIndex: "roomNumber",
      key: "roomNumber",
      sorter: (a, b) => a.roomNumber.localeCompare(b.roomNumber),
    },
    {
      title: "Guest Name",
      dataIndex: "guestName",
      key: "guestName",
      sorter: (a, b) => a.guestName.localeCompare(b.guestName),
    },
    {
      title: "Check-in",
      dataIndex: "checkIn",
      key: "checkIn",
      sorter: (a, b) => dayjs(a.checkIn).unix() - dayjs(b.checkIn).unix(),
    },
    {
      title: "Check-out",
      dataIndex: "checkOut",
      key: "checkOut",
      sorter: (a, b) => dayjs(a.checkOut).unix() - dayjs(b.checkOut).unix(),
    },
    {
      title: "Total Price",
      dataIndex: "totalPrice",
      key: "totalPrice",
      render: (price) => `$${price}`,
      sorter: (a, b) => a.totalPrice - b.totalPrice,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      filters: [
        { text: "Active", value: "active" },
        { text: "Checked-out", value: "checked-out" },
        { text: "Cancelled", value: "cancelled" },
      ],
      onFilter: (value, record) => record.status === value,
      render: (status) => (
        <Tag color={getStatusColor(status)}>
          {status.toUpperCase().replace(/-/g, " ")}
        </Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => {
        const actions = [
          <Button
            key="view"
            icon={<EyeOutlined />}
            onClick={() => handleShowDrawer("view", record)}
            size="small"
          />,
        ];

        if (record.status === "active") {
          actions.push(
            <Button
              key="edit"
              icon={<EditOutlined />}
              onClick={() => handleShowDrawer("edit", record)}
              size="small"
            />,
            <Button
              key="checkout"
              icon={<CheckOutlined />}
              onClick={() => handleCheckout(record.id)}
              size="small"
              style={{ backgroundColor: "#52c41a", color: "white" }}
            />,
            <Button
              key="cancel"
              icon={<CloseOutlined />}
              danger
              onClick={() => handleCancel(record.id)}
              size="small"
            />
          );
        }

        return <Space size="small">{actions}</Space>;
      },
    },
  ];

  const renderDrawerContent = () => {
    if (drawerType === "view" && viewingBooking) {
      return (
        <Descriptions
          bordered
          column={1}
          title={`Booking #${viewingBooking.id}`}
        >
          <Descriptions.Item label="Status">
            <Badge
              status={
                getStatusColor(viewingBooking.status) === "green"
                  ? "success"
                  : getStatusColor(viewingBooking.status) === "blue"
                  ? "processing"
                  : "error"
              }
              text={viewingBooking.status.toUpperCase().replace(/-/g, " ")}
            />
          </Descriptions.Item>
          <Descriptions.Item label="Room Number">
            {viewingBooking.roomNumber}
          </Descriptions.Item>
          <Descriptions.Item label="Guest Name">
            {viewingBooking.guestName}
          </Descriptions.Item>
          <Descriptions.Item label="Phone Number">
            {viewingBooking.phone}
          </Descriptions.Item>
          <Descriptions.Item label="Check-in Date">
            {viewingBooking.checkIn}
          </Descriptions.Item>
          <Descriptions.Item label="Check-out Date">
            {viewingBooking.checkOut}
          </Descriptions.Item>
          <Descriptions.Item label="Total Price">
            ${viewingBooking.totalPrice}
          </Descriptions.Item>

          {viewingBooking.pricePerNight && viewingBooking.basePrice && (
            <>
              <Descriptions.Item label="Base Price">
                ${viewingBooking.basePrice}/night
              </Descriptions.Item>
              <Descriptions.Item label="Applied Price Per Night">
                <Space>
                  ${viewingBooking.pricePerNight}/night
                  {viewingBooking.pricePerNight !==
                    viewingBooking.basePrice && (
                    <Tag
                      color={
                        viewingBooking.pricePerNight > viewingBooking.basePrice
                          ? "red"
                          : "green"
                      }
                    >
                      {viewingBooking.pricePerNight > viewingBooking.basePrice
                        ? "Premium"
                        : "Discount"}{" "}
                      Rate
                    </Tag>
                  )}
                </Space>
              </Descriptions.Item>
            </>
          )}

          {viewingBooking.selectedRuleIds &&
            viewingBooking.selectedRuleIds.length > 0 && (
              <Descriptions.Item label="Applied Price Rules">
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {viewingBooking.selectedRuleIds.split(",").map((ruleId) => {
                    const rule = availableRules.find((r) => r.key === ruleId);
                    return (
                      <li key={ruleId}>
                        {rule ? rule.title : `Rule ID: ${ruleId}`}
                      </li>
                    );
                  })}
                </ul>
              </Descriptions.Item>
            )}

          {viewingBooking.notes && (
            <Descriptions.Item label="Notes">
              {viewingBooking.notes}
            </Descriptions.Item>
          )}
        </Descriptions>
      );
    }

    const disabledDate = (current) => {
      // Can't select days before today
      return current && current < dayjs().startOf("day");
    };

    return (
      <Form form={form} layout="vertical">
        <Form.Item
          name="guestName"
          label="Guest Name"
          rules={[{ required: true, message: "Please enter guest name" }]}
        >
          <Input placeholder="Enter guest name" />
        </Form.Item>

        <Form.Item
          name="phone"
          label="Phone Number"
          rules={[{ required: true, message: "Please enter phone number" }]}
        >
          <Input placeholder="Enter phone number" />
        </Form.Item>

        <Form.Item
          name="dateRange"
          label="Check-in & Check-out Dates"
          rules={[{ required: true, message: "Please select date range" }]}
        >
          <RangePicker
            style={{ width: "100%" }}
            disabledDate={disabledDate}
            format="YYYY-MM-DD"
            onChange={
              drawerType === "edit"
                ? (dates) => {
                    // When editing and dates change, refresh price information
                    if (dates && dates.length === 2) {
                      // Get current form values
                      const currentValues = form.getFieldsValue();
                      const roomId = currentValues.roomId;
                      const [checkIn, checkOut] = dates;

                      const fetchUpdatedPrice = async () => {
                        try {
                          // Get rooms with pricing for these dates
                          await fetchPriceRules();

                          const availableRoomsData = await getAvailableRooms(
                            checkIn.format("YYYY-MM-DD"),
                            checkOut.format("YYYY-MM-DD"),
                            1 // Just need pricing info, not actual availability
                          );

                          // Find the selected room
                          const roomWithPrice = availableRoomsData.find(
                            (r) => r.id === roomId
                          );

                          if (roomWithPrice) {
                            // Update total price
                            setSelectedTotalPrice(roomWithPrice.totalPrice);

                            // Store information about the price
                            const basePrice = roomWithPrice.basePrice;
                            const appliedPrice = roomWithPrice.pricePerNight;
                            const isPriceRuleApplied =
                              basePrice !== appliedPrice;

                            // For manual rule selection mode, recalculate with current rules
                            if (
                              manualPriceRules &&
                              targetSelectedRules.length > 0
                            ) {
                              // Get the selected rules
                              const selectedRules = availableRules
                                .filter((rule) =>
                                  targetSelectedRules.includes(rule.key)
                                )
                                .map((item) => item.rule);

                              // Recalculate with the dates
                              const newPrice = calculatePriceWithRules(
                                basePrice,
                                selectedRules,
                                targetSelectedRules,
                                checkIn.toDate(),
                                checkOut.toDate()
                              );

                              // Update price info
                              setSelectedPriceInfo({
                                basePrice,
                                appliedPrice: newPrice,
                                isPriceRuleApplied: basePrice !== newPrice,
                                nights: roomWithPrice.nights,
                                totalPrice: newPrice * roomWithPrice.nights,
                              });

                              // Update the price display
                              updatePriceDisplay(
                                basePrice,
                                newPrice,
                                roomWithPrice.nights
                              );

                              // Update total price
                              setSelectedTotalPrice(
                                newPrice * roomWithPrice.nights
                              );
                            } else {
                              setSelectedPriceInfo({
                                basePrice,
                                appliedPrice,
                                isPriceRuleApplied,
                                nights: roomWithPrice.nights,
                                totalPrice: roomWithPrice.totalPrice,
                              });

                              // Update the price display
                              updatePriceDisplay(
                                basePrice,
                                appliedPrice,
                                roomWithPrice.nights
                              );
                            }

                            message.info(
                              "Price updated based on selected dates"
                            );
                          }
                        } catch (error) {
                          console.error("Error updating price:", error);
                        }
                      };

                      fetchUpdatedPrice();
                    }
                  }
                : handleDateRangeChange
            }
          />
        </Form.Item>

        <Form.Item
          name="guestCount"
          label="Number of Guests"
          rules={[
            { required: true, message: "Please select number of guests" },
          ]}
          initialValue={1}
        >
          <Select
            style={{ width: "100%" }}
            onChange={drawerType === "new" ? handleGuestCountChange : undefined}
          >
            <Option value={1}>1 Guest</Option>
            <Option value={2}>2 Guests</Option>
            <Option value={3}>3 Guests</Option>
            <Option value={4}>4 Guests</Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="roomId"
          label="Room"
          rules={[{ required: true, message: "Please select a room" }]}
        >
          <Select
            placeholder="Select a room"
            onChange={handleRoomSelect}
            disabled={availableRooms.length === 0}
          >
            {availableRooms.map((room) => {
              // Make sure we have numeric values for display
              const basePrice = parseFloat(room.basePrice) || 0;
              const pricePerNight = parseFloat(room.pricePerNight) || basePrice;
              const isSpecialPrice = pricePerNight !== basePrice;

              return (
                <Option key={room.id} value={room.id}>
                  Room {room.number} ({room.type}) -
                  {isSpecialPrice ? (
                    <span>
                      <span
                        style={{
                          textDecoration: "line-through",
                          marginRight: 5,
                        }}
                      >
                        ${basePrice}
                      </span>
                      <span
                        style={{
                          color: isSpecialPrice
                            ? pricePerNight > basePrice
                              ? "#ff4d4f"
                              : "#52c41a"
                            : "inherit",
                        }}
                      >
                        ${pricePerNight}
                      </span>
                      /night
                    </span>
                  ) : (
                    <span>${pricePerNight}/night</span>
                  )}
                </Option>
              );
            })}
          </Select>
        </Form.Item>

        <div style={{ marginBottom: 24 }}>
          <div
            style={{ marginBottom: 8, display: "flex", alignItems: "center" }}
          >
            <span style={{ color: "#ff4d4f", marginRight: 4 }}>*</span>
            <span>Price Calculation</span>
            {selectedPriceInfo &&
              selectedPriceInfo.isPriceRuleApplied &&
              !manualPriceRules && (
                <Tooltip
                  title={`Special pricing applied: $${selectedPriceInfo.appliedPrice}/night instead of standard $${selectedPriceInfo.basePrice}/night`}
                >
                  <InfoCircleOutlined
                    style={{ marginLeft: 5, color: "#1890ff" }}
                  />
                </Tooltip>
              )}
          </div>

          <div
            style={{
              padding: "16px",
              border: "1px solid #d9d9d9",
              borderRadius: "2px",
              backgroundColor: "#f5f5f5",
              marginBottom: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <div>Base Price:</div>
              <div>${priceDisplay.basePrice.toFixed(2)}/night</div>
            </div>

            {(priceDisplay.hasDiscount || priceDisplay.hasPremium) && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px",
                }}
              >
                <div>{priceDisplay.hasDiscount ? "Discount:" : "Premium:"}</div>
                <div
                  style={{
                    color: priceDisplay.hasDiscount ? "#52c41a" : "#ff4d4f",
                  }}
                >
                  {priceDisplay.hasDiscount ? "-" : "+"}
                  {priceDisplay.percentageChange.toFixed(2)}%
                </div>
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <div>Final Price:</div>
              <div
                style={{
                  fontWeight: "bold",
                  color: priceDisplay.hasDiscount
                    ? "#52c41a"
                    : priceDisplay.hasPremium
                    ? "#ff4d4f"
                    : "inherit",
                }}
              >
                ${priceDisplay.finalPrice.toFixed(2)}/night
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <div>Nights:</div>
              <div>{priceDisplay.nights}</div>
            </div>

            <Divider style={{ margin: "8px 0" }} />

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "16px",
                fontWeight: "bold",
              }}
            >
              <div>Total Price:</div>
              <div>${priceDisplay.totalPrice.toFixed(2)}</div>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
                fontWeight: "bold",
              }}
            >
              <span>Select Pricing Rules</span>
              <Switch
                checked={manualPriceRules}
                onChange={(checked) => {
                  setManualPriceRules(checked);

                  // Reset selected rules
                  setTargetSelectedRules([]);

                  if (!checked) {
                    // Reset to automatic pricing
                    const roomId = form.getFieldValue("roomId");
                    if (roomId) {
                      // Re-select the current room to recalculate prices
                      handleRoomSelect(roomId);
                    } else {
                      // If no room is selected, just reset the price display
                      resetPriceDisplay();
                    }
                  } else {
                    // When enabling manual mode, fetch applicable rules
                    const dateRange = form.getFieldValue("dateRange");
                    const roomId = form.getFieldValue("roomId");

                    if (dateRange && dateRange.length === 2 && roomId) {
                      const [checkIn, checkOut] = dateRange;
                      const startDate = checkIn.format("YYYY-MM-DD");
                      const endDate = checkOut.format("YYYY-MM-DD");

                      // Get rules for the selected date range and room
                      const fetchApplicableRules = async () => {
                        try {
                          const allRules = await getPricesData();
                          const applicableRules = allRules.filter(
                            (rule) =>
                              (rule.roomId === roomId ||
                                rule.roomId === "all") &&
                              datesOverlap(
                                rule.startDate,
                                rule.endDate,
                                startDate,
                                endDate
                              )
                          );

                          // Format applicable rules for the transfer component
                          const formattedRules = applicableRules.map(
                            (rule) => ({
                              key: rule.id,
                              title: rule.name || `Rule ${rule.id}`,
                              description:
                                formatRuleDescription(rule) +
                                ` (${rule.startDate} to ${rule.endDate})`,
                              rule,
                            })
                          );

                          setAvailableRules(formattedRules);
                        } catch (error) {
                          console.error(
                            "Error fetching applicable rules:",
                            error
                          );
                        }
                      };

                      fetchApplicableRules();
                    } else {
                      // If no dates or room selected yet, just notify the user and reset prices
                      message.info(
                        "Please select dates and a room to see applicable pricing rules"
                      );
                      setAvailableRules([]);

                      // Only reset prices if a room isn't selected (to avoid overwriting valid prices)
                      if (!roomId) {
                        resetPriceDisplay();
                      }
                    }
                  }
                }}
              />
            </div>
            {manualPriceRules && (
              <div>
                <div
                  style={{ marginBottom: 8, fontSize: 12, color: "#1890ff" }}
                >
                  Select pricing rules from the left side to apply them to this
                  booking
                </div>
                {availableRules.length > 0 ? (
                  <Transfer
                    dataSource={availableRules}
                    titles={["Available Rules", "Applied Rules"]}
                    targetKeys={targetSelectedRules}
                    onChange={handleRuleSelectionChange}
                    render={(item) => (
                      <div>
                        <span>{item.title}</span>
                        <br />
                        <small>{item.description}</small>
                      </div>
                    )}
                    listStyle={{
                      width: 200,
                      height: 300,
                    }}
                    operations={["Apply", "Remove"]}
                  />
                ) : (
                  <div
                    style={{
                      padding: "16px",
                      backgroundColor: "#f5f5f5",
                      border: "1px dashed #d9d9d9",
                      borderRadius: "2px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ marginBottom: "8px", fontWeight: "bold" }}>
                      No applicable pricing rules
                    </div>
                    <div style={{ fontSize: "12px", color: "#888" }}>
                      There are no pricing rules applicable for the selected
                      room and dates. Check that the rules' date ranges include
                      your booking dates.
                    </div>
                  </div>
                )}
                <div style={{ marginTop: 8, color: "#888", fontSize: 12 }}>
                  Rules are applied from top to bottom.
                </div>
              </div>
            )}
          </div>
        </div>

        <Form.Item name="notes" label="Notes">
          <Input.TextArea
            rows={4}
            placeholder="Enter any additional notes about this booking"
          />
        </Form.Item>

        {drawerType === "edit" && (
          <Form.Item
            name="status"
            label="Status"
            rules={[{ required: true, message: "Please select status" }]}
          >
            <Select>
              <Option value="active">Active</Option>
              <Option value="checked-out">Checked Out</Option>
              <Option value="cancelled">Cancelled</Option>
            </Select>
          </Form.Item>
        )}
      </Form>
    );
  };

  // Add this reset function at the beginning of the component
  const resetPriceDisplay = () => {
    setPriceDisplay({
      basePrice: 0,
      finalPrice: 0,
      nights: 0,
      totalPrice: 0,
      hasDiscount: false,
      hasPremium: false,
      percentageChange: 0,
    });
    setSelectedTotalPrice(0);
    setSelectedPriceInfo(null);
  };

  if (isInitializing) {
    return (
      <AppLayout>
        <div style={{ textAlign: "center", padding: "100px 0" }}>
          <Spin size="large" />
          <p style={{ marginTop: 16 }}>Initializing Google Sheets API...</p>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <Alert message="Error" description={error} type="error" showIcon />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <h1>Bookings</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => handleShowDrawer("new")}
        >
          New Booking
        </Button>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: "active",
            label: "Active Bookings",
            children: (
              <Table
                columns={columns}
                dataSource={bookings.filter((b) => b.status === "active")}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 10 }}
              />
            ),
          },
          {
            key: "checked-out",
            label: "Checked-out",
            children: (
              <Table
                columns={columns}
                dataSource={bookings.filter((b) => b.status === "checked-out")}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 10 }}
              />
            ),
          },
          {
            key: "cancelled",
            label: "Cancelled",
            children: (
              <Table
                columns={columns}
                dataSource={bookings.filter((b) => b.status === "cancelled")}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 10 }}
              />
            ),
          },
          {
            key: "all",
            label: "All Bookings",
            children: (
              <Table
                columns={columns}
                dataSource={bookings}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 10 }}
              />
            ),
          },
        ]}
      />

      <Drawer
        title={drawerTitle}
        placement="right"
        closable={true}
        onClose={handleCloseDrawer}
        open={drawerVisible}
        width={480}
        footer={
          drawerType !== "view" ? (
            <div style={{ textAlign: "right" }}>
              <Button onClick={handleCloseDrawer} style={{ marginRight: 8 }}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} type="primary">
                {drawerType === "edit" ? "Update" : "Create"}
              </Button>
            </div>
          ) : (
            <div style={{ textAlign: "right" }}>
              <Button onClick={handleCloseDrawer}>Close</Button>
            </div>
          )
        }
      >
        {renderDrawerContent()}
      </Drawer>
    </AppLayout>
  );
}
